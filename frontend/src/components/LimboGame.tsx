import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  formatSol,
  fetchLimboRecent,
  playLimbo,
} from "../lib/api";
import { useToast } from "./ui/Toast";
import { useSound } from "../hooks/useSound";
import { PageHeader } from "./PageHeader";
import { BetAmountControls } from "./BetAmountControls";
import { RecentResultsStrip } from "./RecentResultsStrip";
import { SoundToggle } from "./SoundToggle";
import { WinCelebration } from "./WinCelebration";
import { FairnessModal } from "./FairnessModal";
import { GameActionSpinner } from "./GameActionSpinner";
import { ConnectTrigger } from "./ConnectTrigger";
import { fairnessUrl } from "../lib/fairnessLink";
import { hapticPulse } from "../lib/haptics";
import { sliderToTarget, targetToSlider } from "../lib/limboSlider";

interface LimboGameProps {
  walletAddress?: string;
  balanceSol: number;
  minBetSol: number;
  maxBetSol: number;
  limboMinTarget?: number;
  limboMaxTarget?: number;
  limboHouseEdge?: number;
  onChainEnabled?: boolean;
  onBalanceUpdate: (balance: number) => void;
  spectator?: boolean;
}

const PRESET_TARGETS = [1.25, 1.5, 2, 3, 5, 10, 50, 100, 1000];

interface RollRecord {
  id: string;
  multiplier: number;
  won: boolean;
}

export function LimboGame({
  walletAddress,
  balanceSol,
  minBetSol,
  maxBetSol,
  limboMinTarget = 1.25,
  limboMaxTarget = 1000,
  limboHouseEdge = 0.02,
  onBalanceUpdate,
  spectator = false,
}: LimboGameProps) {
  const { toast } = useToast();
  const { muted, volume, toggleMute, setVolume, play } = useSound();
  const [betAmount, setBetAmount] = useState("0.01");
  const [target, setTarget] = useState("2.00");
  const [rolling, setRolling] = useState(false);
  const [displayRoll, setDisplayRoll] = useState<number | null>(null);
  const [rollTone, setRollTone] = useState<"neutral" | "won" | "lost">("neutral");
  const [celebrateWin, setCelebrateWin] = useState(false);
  const [recentRolls, setRecentRolls] = useState<RollRecord[]>([]);
  const tickRef = useRef<number | null>(null);
  const [fairnessOpen, setFairnessOpen] = useState(false);
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
  const sliderValue = targetToSlider(
    isNaN(targetNum) ? 2 : targetNum,
    limboMinTarget,
    limboMaxTarget,
  );

  const winChance = useMemo(() => {
    if (isNaN(targetNum) || targetNum < limboMinTarget) return 0;
    return ((1 - limboHouseEdge) / targetNum) * 100;
  }, [targetNum, limboHouseEdge, limboMinTarget]);

  const potentialWin = useMemo(() => {
    const amount = parseFloat(betAmount);
    if (isNaN(amount)) return 0;
    return amount * targetNum;
  }, [betAmount, targetNum]);

  const animateRoll = (finalValue: number, won: boolean, durationMs = 1200) => {
    setRollTone("neutral");
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = 1 + (finalValue - 1) * eased;
      setDisplayRoll(current);
      if (!muted && t < 1 && Math.random() > 0.85) play("limboTick");
      if (t < 1) {
        tickRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayRoll(finalValue);
        setRollTone(won ? "won" : "lost");
      }
    };
    tickRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
    };
  }, []);

  useEffect(() => {
    fetchLimboRecent()
      .then((rows) => {
        if (rows.length === 0) return;
        setRecentRolls(
          rows.map((r) => ({
            id: r.id,
            multiplier: r.multiplier,
            won: r.won,
          })),
        );
      })
      .catch(() => {
        /* optional strip */
      });
  }, []);

  const handlePlay = useCallback(async () => {
    if (spectator || !walletAddress) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < minBetSol || amount > maxBetSol) {
      toast(`Bet must be between ${minBetSol} and ${maxBetSol} SOL`, "error");
      return;
    }
    if (
      isNaN(targetNum) ||
      targetNum < limboMinTarget ||
      targetNum > limboMaxTarget
    ) {
      toast(
        `Target must be between ${limboMinTarget}x and ${limboMaxTarget}x`,
        "error",
      );
      return;
    }

    setRolling(true);
    setLastResult(null);
    setDisplayRoll(1);
    setRollTone("neutral");
    play("bet");

    try {
      const result = await playLimbo(walletAddress, amount, targetNum);
      animateRoll(result.resultMultiplier, result.won);
      await new Promise((r) => setTimeout(r, 1200));
      setLastResult({
        won: result.won,
        roll: result.roll,
        resultMultiplier: result.resultMultiplier,
        serverSeed: result.serverSeed,
        betId: result.betId,
        clientSeed: result.clientSeed,
      });
      setRecentRolls((prev) =>
        [
          {
            id: result.betId,
            multiplier: result.resultMultiplier,
            won: result.won,
          },
          ...prev,
        ].slice(0, 10),
      );
      play(result.won ? "limboWin" : "limboBust");
      if (result.won) {
        setCelebrateWin(true);
        hapticPulse(16);
      } else {
        hapticPulse(28);
      }
      onBalanceUpdate(result.balanceSol);
      toast(
        result.won
          ? `Hit ${targetNum.toFixed(2)}x — won ${formatSol(result.payoutSol)} SOL!`
          : `Busted at ${result.resultMultiplier.toFixed(2)}x`,
        result.won ? "success" : "info",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Limbo failed", "error");
    } finally {
      setRolling(false);
      setDisplayRoll(null);
      setRollTone("neutral");
    }
  }, [
    spectator,
    walletAddress,
    betAmount,
    minBetSol,
    maxBetSol,
    targetNum,
    limboMinTarget,
    limboMaxTarget,
    toast,
    play,
    muted,
    onBalanceUpdate,
  ]);

  useEffect(() => {
    if (spectator) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Enter" && !rolling) {
        e.preventDefault();
        void handlePlay();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [spectator, rolling, handlePlay]);

  const gaugePercent = Math.min(
    100,
    ((displayRoll ?? (lastResult?.resultMultiplier ?? targetNum)) /
      Math.max(targetNum, 2)) *
      100,
  );

  return (
    <div className="card card-glow limbo-game">
      <div className="game-header-row">
        <PageHeader
          title="Limbo"
          subtitle={`${limboMinTarget.toFixed(2)}× min target · ${((1 - limboHouseEdge) * 100).toFixed(0)}% RTP · 2% house edge`}
        />
        <button
          type="button"
          className="btn btn-outline btn-sm fairness-trigger"
          onClick={() => setFairnessOpen(true)}
          data-testid="limbo-fairness-button"
        >
          Fairness
        </button>
        <SoundToggle
          muted={muted}
          volume={volume}
          onToggle={toggleMute}
          onVolumeChange={setVolume}
        />
      </div>

      <RecentResultsStrip
        title="Recent rolls"
        results={recentRolls.map((r) => ({
          id: r.id,
          label: `${r.multiplier.toFixed(2)}x`,
          variant: r.won ? "win" : "loss",
        }))}
      />

      <div className="limbo-arena">
        <div className="limbo-display game-action-stage">
          <WinCelebration active={celebrateWin} onDone={() => setCelebrateWin(false)} />
          <div className="limbo-gauge limbo-gauge--horizontal">
            <div
              className="limbo-gauge-target"
              style={{ left: `${Math.min(95, (targetNum / limboMaxTarget) * 90 + 5)}%` }}
            />
            <div
              className="limbo-gauge-fill"
              style={{ width: `${gaugePercent}%` }}
            />
          </div>
          <div className="limbo-multiplier-live" aria-live="polite" aria-atomic="true">
            <AnimatePresence mode="wait">
            {rolling || displayRoll !== null ? (
              <motion.div
                key="rolling"
                className={`limbo-multiplier rolling roll-tone-${rollTone}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                {(displayRoll ?? 1).toFixed(2)}x
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
          </div>
          <p className="limbo-target-line">
            Target: <strong>{targetNum.toFixed(2)}x</strong>
          </p>
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
              disabled={rolling || spectator}
            />
            <input
              className="limbo-slider"
              type="range"
              min={0}
              max={100}
              step={1}
              value={sliderValue}
              onChange={(e) => {
                const next = sliderToTarget(
                  parseFloat(e.target.value),
                  limboMinTarget,
                  limboMaxTarget,
                );
                setTarget(next.toFixed(2));
              }}
              disabled={rolling || spectator}
            />
          </div>

          <div className="bet-amount-presets">
            {PRESET_TARGETS.filter((p) => p <= limboMaxTarget).map((p) => (
              <button
                key={p}
                type="button"
                className={`preset-btn ${targetNum === p ? "selected" : ""}`}
                onClick={() => setTarget(p.toFixed(2))}
                disabled={rolling || spectator}
              >
                {p}x
              </button>
            ))}
          </div>

          <BetAmountControls
            balanceSol={balanceSol}
            minBetSol={minBetSol}
            maxBetSol={maxBetSol}
            amount={betAmount}
            onAmountChange={setBetAmount}
            disabled={rolling || spectator}
          />

          {spectator ? (
            <ConnectTrigger intent="play" label="Connect to play" fullWidth testId="limbo-spectator-connect" />
          ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePlay}
            disabled={rolling}
            style={{ width: "100%" }}
          >
            {rolling ? (
              <GameActionSpinner label="Rolling..." />
            ) : (
              `Play Limbo @ ${targetNum.toFixed(2)}x`
            )}
          </button>
          )}
          {!spectator && (
            <p className="game-shortcut-hint text-muted">
              Enter = roll · adjust target with slider or presets
            </p>
          )}

          {lastResult && (
            <p className="limbo-fairness-note">
              Roll: {lastResult.roll} / 10000 ·{" "}
              <a
                className="fairness-link"
                href={fairnessUrl({
                  game: "limbo",
                  betId: lastResult.betId,
                  serverSeed: lastResult.serverSeed,
                  clientSeed: lastResult.clientSeed,
                  targetMultiplier: targetNum,
                })}
              >
                Verify in Fairness tab
              </a>
            </p>
          )}
        </div>
      </div>

      <FairnessModal
        open={fairnessOpen}
        onClose={() => setFairnessOpen(false)}
        initialGame="limbo"
      />
    </div>
  );
}
