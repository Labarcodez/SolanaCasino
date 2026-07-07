import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  confirmLimbo,
  fetchUser,
  formatSol,
  playLimbo,
  prepareLimbo,
  revealLimbo,
} from "../lib/api";
import { useCasino } from "../hooks/CasinoUserProvider";
import { useToast } from "./ui/Toast";
import { PageHeader } from "./PageHeader";
import { prepareTransaction, solscanTxUrl } from "../lib/utils";
import {
  buildLimboBetTransaction,
  ensurePlayerInitialized,
} from "../lib/anchor";

interface LimboGameProps {
  walletAddress: string;
  balanceSol: number;
  minBetSol: number;
  maxBetSol: number;
  limboMinTarget?: number;
  limboMaxTarget?: number;
  limboHouseEdge?: number;
  onChainEnabled?: boolean;
  onBalanceUpdate: (balance: number) => void;
}

const PRESET_TARGETS = [1.5, 2, 3, 5, 10, 50];

export function LimboGame({
  walletAddress,
  balanceSol,
  minBetSol,
  maxBetSol,
  limboMinTarget = 1.01,
  limboMaxTarget = 1000,
  limboHouseEdge = 0.02,
  onChainEnabled,
  onBalanceUpdate,
}: LimboGameProps) {
  const { signAndSendTx, refresh } = useCasino();
  const { toast } = useToast();
  const [betAmount, setBetAmount] = useState("0.01");
  const [target, setTarget] = useState("2.00");
  const [rolling, setRolling] = useState(false);
  const [lastResult, setLastResult] = useState<{
    won: boolean;
    roll: number;
    resultMultiplier: number;
    serverSeed: string;
    betId: string;
    clientSeed: string;
    signature?: string;
  } | null>(null);

  const targetNum = parseFloat(target);
  const winChance = useMemo(() => {
    if (isNaN(targetNum) || targetNum < limboMinTarget) return 0;
    return ((1 - limboHouseEdge) / targetNum) * 100;
  }, [targetNum, limboHouseEdge, limboMinTarget]);

  const potentialWin = useMemo(() => {
    const amount = parseFloat(betAmount);
    if (isNaN(amount)) return 0;
    return amount * targetNum;
  }, [betAmount, targetNum]);

  const handlePlay = async () => {
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < minBetSol || amount > maxBetSol) {
      toast(`Bet must be between ${minBetSol} and ${maxBetSol} SOL`, "error");
      return;
    }
    if (isNaN(targetNum) || targetNum < limboMinTarget || targetNum > limboMaxTarget) {
      toast(`Target must be between ${limboMinTarget}x and ${limboMaxTarget}x`, "error");
      return;
    }

    setRolling(true);
    setLastResult(null);

    try {
      if (onChainEnabled) {
        await ensurePlayerInitialized(walletAddress, signAndSendTx);
        const prepared = await prepareLimbo(walletAddress, targetNum);
        const revealed = await revealLimbo(walletAddress, prepared.prepareId);
        const tx = await buildLimboBetTransaction(
          walletAddress,
          Math.floor(amount * LAMPORTS_PER_SOL),
          targetNum,
          revealed.clientSeed,
          revealed.serverSeed,
          revealed.serverSeedHash,
        );
        await prepareTransaction(walletAddress, tx);
        const { signature } = await signAndSendTx(tx);

        const result = await confirmLimbo({
          walletAddress,
          amountSol: amount,
          targetMultiplier: targetNum,
          clientSeed: revealed.clientSeed,
          serverSeed: revealed.serverSeed,
          signature,
        });

        await new Promise((r) => setTimeout(r, 600));
        setLastResult({
          won: result.won,
          roll: result.roll,
          resultMultiplier: result.resultMultiplier,
          serverSeed: result.serverSeed,
          betId: result.betId,
          clientSeed: result.clientSeed,
          signature,
        });
        await refresh();
        const updated = await fetchUser(walletAddress);
        onBalanceUpdate(updated.balanceSol);

        toast(
          result.won
            ? `Hit ${targetNum.toFixed(2)}x — won ${formatSol(result.payoutSol)} SOL!`
            : `Busted at roll ${result.roll}`,
          result.won ? "success" : "info",
          { label: "View tx", href: solscanTxUrl(signature) },
        );
      } else {
        const result = await playLimbo(walletAddress, amount, targetNum);
        await new Promise((r) => setTimeout(r, 600));
        setLastResult({
          won: result.won,
          roll: result.roll,
          resultMultiplier: result.resultMultiplier,
          serverSeed: result.serverSeed,
          betId: result.betId,
          clientSeed: result.clientSeed,
        });
        onBalanceUpdate(result.balanceSol);
        toast(
          result.won
            ? `Hit ${targetNum.toFixed(2)}x — won ${formatSol(result.payoutSol)} SOL!`
            : `Busted at roll ${result.roll}`,
          result.won ? "success" : "info",
        );
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Limbo failed", "error");
    } finally {
      setRolling(false);
    }
  };

  return (
    <div className="card card-glow limbo-game">
      <PageHeader
        title="Limbo"
        subtitle={`Pick your target · ${((1 - limboHouseEdge) * 100).toFixed(0)}% RTP · 2% house edge`}
        badge={
          onChainEnabled ? (
            <span className="on-chain-badge">
              <span className="on-chain-dot" />
              On-Chain
            </span>
          ) : undefined
        }
      />

      <div className="limbo-arena">
        <div className="limbo-display">
          <AnimatePresence mode="wait">
            {rolling ? (
              <motion.div
                key="rolling"
                className="limbo-multiplier rolling"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                ???
              </motion.div>
            ) : lastResult ? (
              <motion.div
                key="result"
                className={`limbo-multiplier ${lastResult.won ? "won" : "lost"}`}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {lastResult.won
                  ? `${lastResult.resultMultiplier.toFixed(2)}x`
                  : "BUST"}
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                className="limbo-multiplier idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {targetNum.toFixed(2)}x
              </motion.div>
            )}
          </AnimatePresence>
          <p className="limbo-chance">
            Win chance: <strong>{winChance.toFixed(2)}%</strong>
          </p>
          <p className="limbo-potential">
            Potential win: <strong>{formatSol(potentialWin)} SOL</strong>
          </p>
        </div>

        <div className="limbo-controls">
          <div className="input-group">
            <label>Target multiplier</label>
            <input
              className="input"
              type="number"
              step="0.01"
              min={limboMinTarget}
              max={limboMaxTarget}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={rolling}
            />
            <input
              className="limbo-slider"
              type="range"
              min={limboMinTarget}
              max={Math.min(limboMaxTarget, 100)}
              step="0.01"
              value={Math.min(targetNum || 2, 100)}
              onChange={(e) => setTarget(parseFloat(e.target.value).toFixed(2))}
              disabled={rolling}
            />
          </div>

          <div className="bet-amount-presets">
            {PRESET_TARGETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`preset-btn ${targetNum === p ? "selected" : ""}`}
                onClick={() => setTarget(p.toFixed(2))}
                disabled={rolling}
              >
                {p}x
              </button>
            ))}
          </div>

          <div className="input-group">
            <label>Amount — {formatSol(balanceSol)} SOL available</label>
            <input
              className="input"
              type="number"
              step="0.001"
              min={minBetSol}
              max={maxBetSol}
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={rolling}
            />
          </div>

          <div className="bet-amount-presets">
            {["0.01", "0.05", "0.1"].map((p) => (
              <button
                key={p}
                type="button"
                className="preset-btn"
                onClick={() => setBetAmount(p)}
                disabled={rolling}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePlay}
            disabled={rolling}
            style={{ width: "100%" }}
          >
            {rolling ? "Rolling..." : `Play Limbo @ ${targetNum.toFixed(2)}x`}
          </button>

          {lastResult && (
            <p className="limbo-fairness-note">
              Roll: {lastResult.roll} / 10000 · Verify in Fairness tab
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
