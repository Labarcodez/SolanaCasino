import { useState, useEffect, useRef } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useCrashSubscription, useSocket } from "../hooks/useSocket";
import { useCasino } from "../hooks/CasinoUserProvider";
import { useToast } from "../components/ui/Toast";
import { useSound } from "../hooks/useSound";
import { confirmCrashBet } from "../lib/api";
import { prepareTransaction, solscanTxUrl } from "../lib/utils";
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
import { BetAmountControls } from "./BetAmountControls";
import { WinCelebration } from "./WinCelebration";
import { FairnessModal } from "./FairnessModal";

interface CrashGameProps {
  balanceSol: number;
  minBetSol: number;
  maxBetSol: number;
  onBalanceUpdate: (balance: number) => void;
  spectator?: boolean;
  focusMode?: boolean;
  onFocusModeChange?: (focused: boolean) => void;
}

export function CrashGame({
  balanceSol,
  minBetSol,
  maxBetSol,
  onBalanceUpdate,
  spectator = false,
  focusMode = false,
  onFocusModeChange,
}: CrashGameProps) {
  const { crashState, placeBet, cashout } = useCrashSubscription(!spectator);
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
  const [celebrateWin, setCelebrateWin] = useState(false);
  const [fairnessOpen, setFairnessOpen] = useState(false);
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
            href: solscanTxUrl(signature),
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

  const placeBetInternal = async (amount: number) => {
    setLoading(true);
    try {
      const autoCashout =
        autoCashoutEnabled
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
          autoCashout && autoCashout >= 1.01 ? autoCashout : undefined,
        );
        await prepareTransaction(walletAddress, tx);
        const { signature } = await signAndSendTx(tx);
        setOnChainBetActive(true);
        await confirmCrashBet({
          walletAddress,
          roundId,
          amountSol: amount,
          autoCashout: autoCashout && autoCashout >= 1.01 ? autoCashout : undefined,
          signature,
        });
        await refresh();
        play("bet");
        toast(`Bet placed: ${amount} SOL`, "success", {
          label: "View tx",
          href: solscanTxUrl(signature),
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
        play("win");
        setCelebrateWin(true);
        toast(`Cashed out at ${multiplier.toFixed(2)}x!`, "success", {
          label: "View tx",
          href: solscanTxUrl(signature),
        });
      } else {
        const result = await cashout();
        if (result.success && result.balanceSol !== undefined) {
          onBalanceUpdate(result.balanceSol);
          play("cashout");
          play("win");
          setCelebrateWin(true);
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
          {(crashState?.bets?.length ?? 0) > 0 && phase !== "betting" && (
            <span className="crash-player-count">
              {crashState!.bets.length} in round
            </span>
          )}
          <button
            type="button"
            className={`btn btn-outline btn-sm crash-focus-toggle ${focusMode ? "active" : ""}`}
            onClick={() => onFocusModeChange?.(!focusMode)}
            aria-pressed={focusMode}
            data-testid="crash-focus-toggle"
          >
            {focusMode ? "Show panels" : "Focus"}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm fairness-trigger"
            onClick={() => setFairnessOpen(true)}
            data-testid="crash-fairness-button"
          >
            Fairness
          </button>
          <SoundToggle muted={muted} onToggle={toggleMute} />
          <span className={`phase-badge ${phase}`} data-testid="crash-phase-badge">
            {phase}
          </span>
        </div>
      </div>

      {crashState?.history && crashState.history.length > 0 && (
        <div className="crash-history">
          {crashState.history.slice(0, 10).map((h) => (
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
        <div className="crash-chart-stage">
          <WinCelebration active={celebrateWin} onDone={() => setCelebrateWin(false)} />
          <CrashChart
            multiplier={multiplier}
            phase={phase}
            crashPoint={crashState?.crashPoint}
          />
        </div>
      </div>

      <CrashFairnessBar
        roundId={crashState?.id}
        serverSeedHash={crashState?.serverSeedHash}
        serverSeed={crashState?.serverSeed}
        crashPoint={crashState?.crashPoint}
        phase={phase}
      />

      <div className={`bet-controls crash-bet-controls ${spectator ? "crash-bet-controls--spectator" : ""}`}>
        {spectator && (
          <div className="spectator-connect-banner" data-testid="spectator-connect-banner">
            <p>Connect your wallet to place bets and cash out.</p>
          </div>
        )}

        <BetAmountControls
          balanceSol={balanceSol}
          minBetSol={minBetSol}
          maxBetSol={maxBetSol}
          amount={betAmount}
          onAmountChange={setBetAmount}
          disabled={hasActiveBet || spectator}
        />

        <AutoCashoutControl
          enabled={autoCashoutEnabled}
          value={autoCashoutValue}
          onEnabledChange={setAutoCashoutEnabled}
          onValueChange={setAutoCashoutValue}
          disabled={hasActiveBet || spectator}
          onChain={onChain}
        />

        <div className="bet-actions crash-bet-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleBet}
            disabled={spectator || loading || hasActiveBet || !canBet}
            data-testid="crash-place-bet"
          >
            {spectator
              ? "Connect to bet"
              : hasActiveBet
                ? "Bet locked in"
                : pendingBet !== null
                  ? "Queued for next round"
                  : phase !== "betting"
                    ? "Bet next round"
                    : "Place bet"}
          </button>
          <button
            type="button"
            className="btn btn-success btn-cashout-hero"
            onClick={handleCashout}
            disabled={spectator || loading || phase !== "running" || !hasActiveBet}
            data-testid="crash-cashout"
          >
            {phase === "running"
              ? `Cash out @ ${multiplier.toFixed(2)}x`
              : "Cash out"}
          </button>
        </div>
      </div>

      <FairnessModal
        open={fairnessOpen}
        onClose={() => setFairnessOpen(false)}
        initialGame="crash"
      />

      <CrashHistoryModal
        round={selectedRound}
        onClose={() => setSelectedRound(null)}
      />
    </div>
  );
}
