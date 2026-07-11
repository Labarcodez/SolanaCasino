import { useState, useEffect, useRef, useCallback } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useCrashSubscription, useSocket } from "../hooks/useSocket";
import { useToast } from "../components/ui/Toast";
import { useSound } from "../hooks/useSound";
import { PageHeader } from "./PageHeader";
import { CrashChart } from "./CrashChart";
import { BettingCountdown } from "./BettingCountdown";
import { CrashFairnessBar } from "./CrashFairnessBar";
import { CrashHistoryModal } from "./CrashHistoryModal";
import { SoundToggle } from "./SoundToggle";
import { WinFeed } from "./WinFeed";
import { WinCelebration } from "./WinCelebration";
import { FairnessModal } from "./FairnessModal";
import { CrashBetStatusCard } from "./CrashBetStatusCard";
import { CrashBetSlot, type CrashBetSlotIndex } from "./CrashBetSlot";
import { ConnectTrigger } from "./ConnectTrigger";

interface CrashGameProps {
  balanceSol: number;
  minBetSol: number;
  maxBetSol: number;
  onBalanceUpdate: (balance: number) => void;
  spectator?: boolean;
  focusMode?: boolean;
  onFocusModeChange?: (focused: boolean) => void;
}

interface SlotUiState {
  betAmount: string;
  autoCashoutEnabled: boolean;
  autoCashoutValue: string;
  pendingBet: number | null;
  cashingOut: boolean;
}

const DEFAULT_SLOT: SlotUiState = {
  betAmount: "0.01",
  autoCashoutEnabled: false,
  autoCashoutValue: "2",
  pendingBet: null,
  cashingOut: false,
};

function betSlot(bet: { slot?: 0 | 1 } | undefined): CrashBetSlotIndex {
  return bet?.slot === 1 ? 1 : 0;
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
  const { toast } = useToast();
  const { muted, toggleMute, play } = useSound();

  const [slots, setSlots] = useState<[SlotUiState, SlotUiState]>([
    { ...DEFAULT_SLOT, autoCashoutValue: "1.5" },
    { ...DEFAULT_SLOT, autoCashoutValue: "5" },
  ]);
  const [loadingSlot, setLoadingSlot] = useState<CrashBetSlotIndex | null>(
    null,
  );
  const [selectedRound, setSelectedRound] = useState<{
    roundId: string;
    crashPoint: number;
  } | null>(null);
  const [celebrateWin, setCelebrateWin] = useState(false);
  const [fairnessOpen, setFairnessOpen] = useState(false);
  const lastPhaseRef = useRef<string>("betting");
  const lastTickRef = useRef(0);

  const phase = crashState?.phase ?? "betting";
  const multiplier = crashState?.multiplier ?? 1.0;

  const myBetForSlot = useCallback(
    (slot: CrashBetSlotIndex) =>
      crashState?.myBets?.find(
        (b) => !b.cashedOut && betSlot(b) === slot,
      ),
    [crashState?.myBets],
  );

  const hasActiveBetForSlot = (slot: CrashBetSlotIndex) =>
    !!myBetForSlot(slot);

  const updateSlot = (
    slot: CrashBetSlotIndex,
    patch: Partial<SlotUiState>,
  ) => {
    setSlots((prev) => {
      const next: [SlotUiState, SlotUiState] = [...prev] as [
        SlotUiState,
        SlotUiState,
      ];
      next[slot] = { ...next[slot], ...patch };
      return next;
    });
  };

  const chartAutoTarget = (() => {
    for (const slot of [0, 1] as const) {
      const ui = slots[slot];
      if (
        ui.autoCashoutEnabled &&
        parseFloat(ui.autoCashoutValue) >= 1.01 &&
        (hasActiveBetForSlot(slot) || phase === "betting")
      ) {
        return parseFloat(ui.autoCashoutValue);
      }
    }
    return undefined;
  })();

  useEffect(() => {
    if (phase === "betting" && lastPhaseRef.current !== "betting") {
      setSlots((prev) =>
        prev.map((s) => ({ ...s, cashingOut: false })) as [
          SlotUiState,
          SlotUiState,
        ],
      );
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
    if (phase !== "betting") return;
    for (const slot of [0, 1] as const) {
      const pending = slots[slot].pendingBet;
      if (pending !== null && !hasActiveBetForSlot(slot)) {
        updateSlot(slot, { pendingBet: null });
        void placeBetInternal(pending, slot);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, slots[0].pendingBet, slots[1].pendingBet]);

  const placeBetInternal = async (
    amount: number,
    slot: CrashBetSlotIndex,
  ) => {
    setLoadingSlot(slot);
    const ui = slots[slot];
    try {
      const autoCashout = ui.autoCashoutEnabled
        ? parseFloat(ui.autoCashoutValue)
        : undefined;

      const result = await placeBet(
        amount,
        autoCashout && autoCashout >= 1.01 ? autoCashout : undefined,
        slot,
      );
      if (result.success && result.balanceSol !== undefined) {
        onBalanceUpdate(result.balanceSol);
        play("bet");
        const label = slot === 0 ? "A" : "B";
        toast(
          autoCashout
            ? `Bet ${label} placed with auto @ ${autoCashout}x`
            : `Bet ${label} placed: ${amount} SOL`,
          "success",
        );
      } else {
        toast(result.error ?? "Bet failed", "error");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Bet failed", "error");
    } finally {
      setLoadingSlot(null);
    }
  };

  const handleBet = async (slot: CrashBetSlotIndex) => {
    const amount = parseFloat(slots[slot].betAmount);
    if (isNaN(amount) || amount < minBetSol || amount > maxBetSol) {
      toast(`Bet must be between ${minBetSol} and ${maxBetSol} SOL`, "error");
      return;
    }

    if (phase !== "betting") {
      updateSlot(slot, { pendingBet: amount });
      toast(`Bet ${slot === 0 ? "A" : "B"} queued for next round`, "info");
      return;
    }

    await placeBetInternal(amount, slot);
  };

  const handleCashout = async (slot: CrashBetSlotIndex) => {
    if (slots[slot].cashingOut) return;
    updateSlot(slot, { cashingOut: true });
    try {
      const result = await cashout(slot);
      if (result.success && result.balanceSol !== undefined) {
        onBalanceUpdate(result.balanceSol);
        play("cashout");
        play("win");
        setCelebrateWin(true);
        toast(
          `Bet ${slot === 0 ? "A" : "B"} cashed out at ${multiplier.toFixed(2)}x!`,
          "success",
        );
      } else {
        toast(result.error ?? "Cashout failed", "error");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Cashout failed", "error");
    } finally {
      updateSlot(slot, { cashingOut: false });
    }
  };

  const canBetForSlot = (slot: CrashBetSlotIndex) =>
    !hasActiveBetForSlot(slot) && phase !== "crashed";

  useEffect(() => {
    if (spectator) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Space" && phase === "running") {
        e.preventDefault();
        if (hasActiveBetForSlot(0) && !slots[0].cashingOut) {
          void handleCashout(0);
        } else if (hasActiveBetForSlot(1) && !slots[1].cashingOut) {
          void handleCashout(1);
        }
      }
      if (e.code === "Enter" && canBetForSlot(0) && loadingSlot === null) {
        e.preventDefault();
        void handleBet(0);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spectator, phase, slots, loadingSlot]);

  return (
    <div className="card card-glow crash-game-card">
      <div className="crash-header">
        <PageHeader
          title="Crash"
          subtitle="Dual bet · independent auto-cashout per panel"
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
            startedAt={crashState?.startedAt}
            autoCashoutTarget={chartAutoTarget}
          />
        </div>
      </div>

      {!spectator && (
        <div className="crash-bet-status-grid">
          {([0, 1] as const).map((slot) => {
            const bet = myBetForSlot(slot);
            const active = hasActiveBetForSlot(slot);
            if (!active && phase !== "crashed") return null;
            const amountSol = bet
              ? bet.amountLamports / LAMPORTS_PER_SOL
              : parseFloat(slots[slot].betAmount) || 0;
            return (
              <CrashBetStatusCard
                key={slot}
                betAmountSol={amountSol}
                multiplier={multiplier}
                phase={phase}
                visible
                cashingOut={slots[slot].cashingOut}
              />
            );
          })}
        </div>
      )}

      <CrashFairnessBar
        roundId={crashState?.id}
        serverSeedHash={crashState?.serverSeedHash}
        serverSeed={crashState?.serverSeed}
        crashPoint={crashState?.crashPoint}
        phase={phase}
      />

      <div
        className={`bet-controls crash-bet-controls crash-dual-bet ${spectator ? "crash-bet-controls--spectator" : ""}`}
      >
        {spectator && (
          <div
            className="spectator-connect-banner"
            data-testid="spectator-connect-banner"
          >
            <p>Connect your wallet to place bets and cash out.</p>
            <ConnectTrigger
              intent="play"
              label="Connect to bet"
              size="sm"
              testId="spectator-connect-trigger"
            />
          </div>
        )}

        <div className="crash-dual-bet-grid">
          {([0, 1] as const).map((slot) => (
            <CrashBetSlot
              key={slot}
              slot={slot}
              label={slot === 0 ? "Bet A" : "Bet B"}
              balanceSol={balanceSol}
              minBetSol={minBetSol}
              maxBetSol={maxBetSol}
              amount={slots[slot].betAmount}
              onAmountChange={(v) => updateSlot(slot, { betAmount: v })}
              autoCashoutEnabled={slots[slot].autoCashoutEnabled}
              autoCashoutValue={slots[slot].autoCashoutValue}
              onAutoCashoutEnabledChange={(v) =>
                updateSlot(slot, { autoCashoutEnabled: v })
              }
              onAutoCashoutValueChange={(v) =>
                updateSlot(slot, { autoCashoutValue: v })
              }
              hasActiveBet={hasActiveBetForSlot(slot)}
              canBet={canBetForSlot(slot)}
              canCashout={
                phase === "running" && hasActiveBetForSlot(slot)
              }
              cashingOut={slots[slot].cashingOut}
              phase={phase}
              multiplier={multiplier}
              pendingQueued={slots[slot].pendingBet !== null}
              spectator={spectator}
              loading={loadingSlot === slot}
              onPlaceBet={() => void handleBet(slot)}
              onCashout={() => void handleCashout(slot)}
            />
          ))}
        </div>

        {!spectator && (
          <p className="crash-shortcuts-hint" aria-hidden="true">
            Space = cash out Bet A (or B) · Enter = place Bet A
          </p>
        )}
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
