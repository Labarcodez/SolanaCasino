import { AutoCashoutControl } from "./AutoCashoutControl";
import { BetAmountControls } from "./BetAmountControls";
import { GameActionSpinner } from "./GameActionSpinner";

export type CrashBetSlotIndex = 0 | 1;

interface CrashBetSlotProps {
  slot: CrashBetSlotIndex;
  label: string;
  balanceSol: number;
  minBetSol: number;
  maxBetSol: number;
  amount: string;
  onAmountChange: (value: string) => void;
  autoCashoutEnabled: boolean;
  autoCashoutValue: string;
  onAutoCashoutEnabledChange: (enabled: boolean) => void;
  onAutoCashoutValueChange: (value: string) => void;
  hasActiveBet: boolean;
  canBet: boolean;
  canCashout: boolean;
  cashingOut: boolean;
  phase: string;
  multiplier: number;
  pendingQueued: boolean;
  spectator: boolean;
  loading: boolean;
  onPlaceBet: () => void;
  onCashout: () => void;
}

export function CrashBetSlot({
  slot,
  label,
  balanceSol,
  minBetSol,
  maxBetSol,
  amount,
  onAmountChange,
  autoCashoutEnabled,
  autoCashoutValue,
  onAutoCashoutEnabledChange,
  onAutoCashoutValueChange,
  hasActiveBet,
  canBet,
  canCashout,
  cashingOut,
  phase,
  multiplier,
  pendingQueued,
  spectator,
  loading,
  onPlaceBet,
  onCashout,
}: CrashBetSlotProps) {
  const controlsDisabled = spectator || hasActiveBet;

  return (
    <div
      className={`crash-bet-slot ${hasActiveBet ? "crash-bet-slot--active" : ""}`}
      data-testid={`crash-bet-slot-${slot}`}
    >
      <div className="crash-bet-slot-header">
        <span className="crash-bet-slot-label">{label}</span>
        {hasActiveBet && phase === "running" && (
          <span className="crash-bet-slot-live">Live</span>
        )}
      </div>

      <BetAmountControls
        balanceSol={balanceSol}
        minBetSol={minBetSol}
        maxBetSol={maxBetSol}
        amount={amount}
        onAmountChange={onAmountChange}
        disabled={controlsDisabled}
      />

      <AutoCashoutControl
        enabled={autoCashoutEnabled}
        value={autoCashoutValue}
        onEnabledChange={onAutoCashoutEnabledChange}
        onValueChange={onAutoCashoutValueChange}
        disabled={controlsDisabled}
      />

      <div className="bet-actions crash-bet-slot-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onPlaceBet}
          disabled={spectator || loading || hasActiveBet || !canBet}
          data-testid={`crash-place-bet-${slot}`}
        >
          {loading ? (
            <GameActionSpinner label="Placing bet…" />
          ) : spectator ? (
            "Connect"
          ) : hasActiveBet ? (
            "Locked in"
          ) : pendingQueued ? (
            "Queued"
          ) : phase !== "betting" ? (
            "Bet next"
          ) : (
            "Place bet"
          )}
        </button>
        <button
          type="button"
          className={`btn btn-success ${canCashout ? "btn-cashout-hero btn-cashout-hero--live" : ""}`}
          onClick={onCashout}
          disabled={spectator || cashingOut || !canCashout}
          data-testid={`crash-cashout-${slot}`}
        >
          {cashingOut
            ? "Cashing out…"
            : canCashout
              ? `Cash @ ${multiplier.toFixed(2)}x`
              : "Cash out"}
        </button>
      </div>
    </div>
  );
}
