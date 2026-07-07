import { useState, useEffect, useRef } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useCrashSubscription, useSocket } from "../hooks/useSocket";
import { useCasino } from "../hooks/CasinoUserProvider";
import { useToast } from "../components/ui/Toast";
import { useSound } from "../hooks/useSound";
import { formatSol } from "../lib/api";
import { prepareTransaction } from "../lib/utils";
import {
  buildCashoutTransaction,
  buildPlaceBetTransaction,
  buildSettleBetTransaction,
  ensurePlayerInitialized,
} from "../lib/anchor";
import { PageHeader } from "./PageHeader";
import { CrashChart } from "./CrashChart";
import { BettingCountdown } from "./BettingCountdown";
import { CrashFairnessBar } from "./CrashFairnessBar";
import { AutoCashoutControl } from "./AutoCashoutControl";
import { CrashHistoryModal } from "./CrashHistoryModal";
import { SoundToggle } from "./SoundToggle";
import { WinFeed } from "./WinFeed";

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
  const { recentCashouts } = useSocket();
  const { config, walletAddress, signAndSendTx, refresh } = useCasino();
  const { toast } = useToast();
  const { muted, toggleMute, play } = useSound();

  const [betAmount, setBetAmount] = useState("0.01");
  const [loading, setLoading] = useState(false);
  const [onChainBetActive, setOnChainBetActive] = useState(false);
  const [onChainCashedOut, setOnChainCashedOut] = useState(false);
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);
  const [autoCashoutValue, setAutoCashoutValue] = useState("2");
  const [pendingBet, setPendingBet] = useState<number | null>(null);
  const [selectedRound, setSelectedRound] = useState<{
    roundId: string;
    crashPoint: number;
  } | null>(null);
  const settledRoundRef = useRef<string | null>(null);
  const lastPhaseRef = useRef<string>("betting");
  const lastTickRef = useRef(0);

  const phase = crashState?.phase ?? "betting";
  const multiplier = crashState?.multiplier ?? 1.0;
  const onChain = config?.onChainEnabled ?? false;
  const myBet = crashState?.myBets?.find((b) => !b.cashedOut);
  const hasActiveBet = onChain ? onChainBetActive && !onChainCashedOut : !!myBet;

  useEffect(() => {
    if (phase === "betting" && lastPhaseRef.current !== "betting") {
      setOnChainBetActive(false);
      setOnChainCashedOut(false);
      settledRoundRef.current = null;
    }
    if (phase === "crashed" && lastPhaseRef.current !== "crashed") {
      play("crash");
    }
    if (phase === "running" && lastPhaseRef.current === "betting") {
      play("bet");
    }
    lastPhaseRef.current = phase;
  }, [phase, play]);

  useEffect(() => {
    if (phase === "running") {
      const tick = Math.floor(multiplier * 10);
      if (tick !== lastTickRef.current && tick % 5 === 0) {
        play("tick");
        lastTickRef.current = tick;
      }
    }
  }, [multiplier, phase, play]);

  useEffect(() => {
    if (phase === "betting" && pendingBet !== null && !hasActiveBet) {
      const amount = pendingBet;
      setPendingBet(null);
      void placeBetInternal(amount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pendingBet, hasActiveBet]);

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
  }, [
    phase,
    onChain,
    onChainBetActive,
    walletAddress,
    crashState?.id,
    signAndSendTx,
    refresh,
    toast,
  ]);

  const adjustBet = (factor: number) => {
    const current = parseFloat(betAmount) || minBetSol;
    const next = Math.min(
      maxBetSol,
      Math.max(minBetSol, Math.round(current * factor * 1000) / 1000),
    );
    setBetAmount(String(next));
  };

  const placeBetInternal = async (amount: number) => {
    setLoading(true);
    try {
      const autoCashout =
        autoCashoutEnabled && !onChain
          ? parseFloat(autoCashoutValue)
          : undefined;

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
        play("bet");
        toast(`Bet placed: ${amount} SOL`, "success", {
          label: "View tx",
          href: `https://solscan.io/tx/${signature}?cluster=devnet`,
        });
      } else {
        const result = await placeBet(
          amount,
          autoCashout && autoCashout >= 1.01 ? autoCashout : undefined,
        );
        if (result.success && result.balanceSol !== undefined) {
          onBalanceUpdate(result.balanceSol);
          play("bet");
          toast(
            autoCashout
              ? `Bet placed with auto @ ${autoCashout}x`
              : `Bet placed: ${amount} SOL`,
            "success",
          );
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

  const handleBet = async () => {
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < minBetSol || amount > maxBetSol) {
      toast(`Bet must be between ${minBetSol} and ${maxBetSol} SOL`, "error");
      return;
    }

    if (phase !== "betting") {
      setPendingBet(amount);
      toast("Bet queued for next round", "info");
      return;
    }

    await placeBetInternal(amount);
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
        play("cashout");
        toast(`Cashed out at ${multiplier.toFixed(2)}x!`, "success", {
          label: "View tx",
          href: `https://solscan.io/tx/${signature}?cluster=devnet`,
        });
      } else {
        const result = await cashout();
        if (result.success && result.balanceSol !== undefined) {
          onBalanceUpdate(result.balanceSol);
          play("cashout");
          play("win");
          toast(`Cashed out at ${multiplier.toFixed(2)}x!`, "success");
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

  const canBet = !hasActiveBet && phase !== "crashed";

  return (
    <div className="card card-glow crash-game-card">
      <div className="crash-header">
        <PageHeader
          title="Crash"
          subtitle="Ride the multiplier · cash out before the bust"
        />
        <div className="crash-header-actions">
          <WinFeed cashouts={recentCashouts} />
          <SoundToggle muted={muted} onToggle={toggleMute} />
          <span className={`phase-badge ${phase}`}>{phase}</span>
        </div>
      </div>

      {crashState?.history && crashState.history.length > 0 && (
        <div className="crash-history">
          {crashState.history.slice(0, 16).map((h) => (
            <button
              key={h.roundId}
              type="button"
              className={`history-pill ${
                h.crashPoint < 1.5 ? "low" : h.crashPoint < 3 ? "mid" : "high"
              }`}
              onClick={() => setSelectedRound(h)}
            >
              {h.crashPoint.toFixed(2)}x
            </button>
          ))}
        </div>
      )}

      <BettingCountdown
        phase={phase}
        bettingEndsAt={crashState?.bettingEndsAt}
        startedAt={crashState?.startedAt}
      />

      <div className={phase === "crashed" ? "crash-shake" : ""}>
        <CrashChart
          multiplier={multiplier}
          phase={phase}
          crashPoint={crashState?.crashPoint}
        />
      </div>

      <CrashFairnessBar
        roundId={crashState?.id}
        serverSeedHash={crashState?.serverSeedHash}
        serverSeed={crashState?.serverSeed}
        crashPoint={crashState?.crashPoint}
        phase={phase}
      />

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
            disabled={hasActiveBet}
          />
        </div>

        <div className="bet-amount-presets">
          {["0.01", "0.05", "0.1", "0.5"].map((preset) => (
            <button
              key={preset}
              type="button"
              className="preset-btn"
              onClick={() => setBetAmount(preset)}
              disabled={hasActiveBet}
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            className="preset-btn"
            onClick={() => adjustBet(0.5)}
            disabled={hasActiveBet}
          >
            ½
          </button>
          <button
            type="button"
            className="preset-btn"
            onClick={() => adjustBet(2)}
            disabled={hasActiveBet}
          >
            2×
          </button>
          <button
            type="button"
            className="preset-btn"
            onClick={() => setBetAmount(String(Math.min(balanceSol, maxBetSol)))}
            disabled={hasActiveBet}
          >
            Max
          </button>
        </div>

        <AutoCashoutControl
          enabled={autoCashoutEnabled}
          value={autoCashoutValue}
          onEnabledChange={setAutoCashoutEnabled}
          onValueChange={setAutoCashoutValue}
          disabled={hasActiveBet}
          onChain={onChain}
        />

        <div className="bet-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleBet}
            disabled={loading || hasActiveBet || !canBet}
          >
            {hasActiveBet
              ? "Bet locked in"
              : pendingBet !== null
                ? "Queued for next round"
                : phase !== "betting"
                  ? "Bet next round"
                  : "Place bet"}
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

      <CrashHistoryModal
        round={selectedRound}
        onClose={() => setSelectedRound(null)}
      />
    </div>
  );
}
