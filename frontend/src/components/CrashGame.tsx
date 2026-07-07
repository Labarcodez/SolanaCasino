import { useState, useEffect, useRef } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useCrashSubscription } from "../hooks/useSocket";
import { useCasino } from "../hooks/CasinoUserProvider";
import { useToast } from "../components/ui/Toast";
import { formatSol } from "../lib/api";
import { prepareTransaction } from "../lib/utils";
import {
  buildCashoutTransaction,
  buildPlaceBetTransaction,
  buildSettleBetTransaction,
  ensurePlayerInitialized,
} from "../lib/anchor";
import { CrashChart } from "./CrashChart";

interface CrashGameProps {
  balanceSol: number;
  minBetSol: number;
  maxBetSol: number;
  onBalanceUpdate: (balance: number) => void;
}

export function CrashGame({
  balanceSol,
  minBetSol,
  maxBetSol,
  onBalanceUpdate,
}: CrashGameProps) {
  const { crashState, placeBet, cashout } = useCrashSubscription(true);
  const { config, walletAddress, signAndSendTx, refresh } = useCasino();
  const { toast } = useToast();
  const [betAmount, setBetAmount] = useState("0.01");
  const [loading, setLoading] = useState(false);
  const [onChainBetActive, setOnChainBetActive] = useState(false);
  const [onChainCashedOut, setOnChainCashedOut] = useState(false);
  const settledRoundRef = useRef<string | null>(null);

  const phase = crashState?.phase ?? "betting";
  const multiplier = crashState?.multiplier ?? 1.0;
  const onChain = config?.onChainEnabled ?? false;
  const myBet = crashState?.myBets?.find((b) => !b.cashedOut);
  const hasActiveBet = onChain ? onChainBetActive && !onChainCashedOut : !!myBet;

  useEffect(() => {
    if (phase === "betting") {
      setOnChainBetActive(false);
      setOnChainCashedOut(false);
      settledRoundRef.current = null;
    }
  }, [phase, crashState?.id]);

  useEffect(() => {
    if (
      onChain &&
      phase === "crashed" &&
      onChainBetActive &&
      walletAddress &&
      crashState?.id &&
      settledRoundRef.current !== crashState.id
    ) {
      settledRoundRef.current = crashState.id;
      void (async () => {
        try {
          const tx = await buildSettleBetTransaction(
            walletAddress,
            Number(crashState.id),
          );
          await prepareTransaction(walletAddress, tx);
          const { signature } = await signAndSendTx(tx);
          await refresh();
          toast("Bet settled on-chain!", "success", {
            label: "View on Solscan",
            href: `https://solscan.io/tx/${signature}?cluster=devnet`,
          });
        } catch (err) {
          console.error("settle_bet failed:", err);
          toast("Failed to settle bet", "error");
        } finally {
          setOnChainBetActive(false);
        }
      })();
    }
  }, [phase, onChain, onChainBetActive, walletAddress, crashState?.id, signAndSendTx, refresh, toast]);

  const handleBet = async () => {
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < minBetSol || amount > maxBetSol) {
      toast(`Bet must be between ${minBetSol} and ${maxBetSol} SOL`, "error");
      return;
    }

    setLoading(true);
    try {
      if (onChain && walletAddress) {
        await ensurePlayerInitialized(walletAddress, signAndSendTx);
        const roundId = Number(crashState?.id ?? 0);
        if (!roundId) throw new Error("Round not ready");

        const tx = await buildPlaceBetTransaction(
          walletAddress,
          roundId,
          Math.floor(amount * LAMPORTS_PER_SOL),
        );
        await prepareTransaction(walletAddress, tx);
        const { signature } = await signAndSendTx(tx);
        setOnChainBetActive(true);
        await refresh();
        toast(`Bet placed: ${amount} SOL`, "success", {
          label: "View tx",
          href: `https://solscan.io/tx/${signature}?cluster=devnet`,
        });
      } else {
        const result = await placeBet(amount);
        if (result.success && result.balanceSol !== undefined) {
          onBalanceUpdate(result.balanceSol);
          toast(`Bet placed: ${amount} SOL`, "success");
        } else {
          toast(result.error ?? "Bet failed", "error");
        }
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Bet failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCashout = async () => {
    setLoading(true);
    try {
      if (onChain && walletAddress && crashState?.id) {
        const tx = await buildCashoutTransaction(
          walletAddress,
          Number(crashState.id),
        );
        await prepareTransaction(walletAddress, tx);
        const { signature } = await signAndSendTx(tx);
        setOnChainCashedOut(true);
        await refresh();
        toast(`Cashed out at ${multiplier.toFixed(2)}x!`, "success", {
          label: "View tx",
          href: `https://solscan.io/tx/${signature}?cluster=devnet`,
        });
      } else {
        const result = await cashout();
        if (result.success && result.balanceSol !== undefined) {
          onBalanceUpdate(result.balanceSol);
          toast("Cashed out successfully!", "success");
        } else {
          toast(result.error ?? "Cashout failed", "error");
        }
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Cashout failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card card-glow">
      <div className="crash-header">
        <h3 className="card-title">Crash</h3>
        <span className={`phase-badge ${phase}`}>{phase}</span>
      </div>

      {crashState?.history && crashState.history.length > 0 && (
        <div className="crash-history">
          {crashState.history.slice(0, 14).map((h) => (
            <span
              key={h.roundId}
              className={`history-pill ${
                h.crashPoint < 1.5 ? "low" : h.crashPoint < 3 ? "mid" : "high"
              }`}
            >
              {h.crashPoint.toFixed(2)}x
            </span>
          ))}
        </div>
      )}

      <CrashChart
        multiplier={multiplier}
        phase={phase}
        crashPoint={crashState?.crashPoint}
      />

      {phase === "crashed" && crashState?.serverSeed && (
        <p className="crash-fairness-hint">
          Seed revealed — verify in the Fairness tab
        </p>
      )}

      <div className="bet-controls">
        <div className="input-group">
          <label>Bet amount — {formatSol(balanceSol)} SOL available</label>
          <input
            className="input"
            type="number"
            step="0.001"
            min={minBetSol}
            max={maxBetSol}
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            disabled={phase !== "betting" || hasActiveBet}
          />
        </div>

        <div className="bet-amount-presets">
          {["0.01", "0.05", "0.1", "0.5"].map((preset) => (
            <button
              key={preset}
              type="button"
              className="preset-btn"
              onClick={() => setBetAmount(preset)}
              disabled={phase !== "betting" || hasActiveBet}
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            className="preset-btn"
            onClick={() => setBetAmount(String(Math.min(balanceSol, maxBetSol)))}
            disabled={phase !== "betting" || hasActiveBet}
          >
            Max
          </button>
        </div>

        <div className="bet-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleBet}
            disabled={loading || phase !== "betting" || hasActiveBet}
          >
            {hasActiveBet ? "Bet locked in" : "Place bet"}
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={handleCashout}
            disabled={loading || phase !== "running" || !hasActiveBet}
          >
            {phase === "running"
              ? `Cash out @ ${multiplier.toFixed(2)}x`
              : "Cash out"}
          </button>
        </div>
      </div>
    </div>
  );
}
