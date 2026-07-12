import type { CrashPhase } from "../hooks/useSocket";

interface CrashBetStatusCardProps {
  betAmountSol: number;
  /** Live round multiplier while running. */
  multiplier: number;
  phase: CrashPhase;
  visible: boolean;
  cashingOut?: boolean;
  /** True when this slot has an on-server bet that already cashed out. */
  cashedOut?: boolean;
  /** Cashout multiplier if cashed; ignored when not cashed out. */
  cashoutMultiplier?: number;
  /** Payout in SOL if cashed; when lost, profit is -betAmountSol. */
  payoutSol?: number;
}

export function CrashBetStatusCard({
  betAmountSol,
  multiplier,
  phase,
  visible,
  cashingOut = false,
  cashedOut = false,
  cashoutMultiplier,
  payoutSol,
}: CrashBetStatusCardProps) {
  if (!visible || phase === "betting" || phase === "cooldown") return null;
  if (betAmountSol <= 0) return null;

  let profitSol: number;
  let displayPayoutSol: number;

  if (cashedOut) {
    displayPayoutSol =
      payoutSol ?? betAmountSol * (cashoutMultiplier ?? multiplier);
    profitSol = displayPayoutSol - betAmountSol;
  } else if (phase === "crashed") {
    // Still in at crash = lost stake
    displayPayoutSol = 0;
    profitSol = -betAmountSol;
  } else {
    // Running — live paper profit if they cash out now
    displayPayoutSol = betAmountSol * multiplier;
    profitSol = displayPayoutSol - betAmountSol;
  }

  const profitPositive = profitSol >= 0;

  return (
    <div
      className={`crash-bet-status ${cashingOut ? "crash-bet-status--pending" : ""} ${
        phase === "crashed" && !cashedOut ? "crash-bet-status--lost" : ""
      }`}
      data-testid="crash-bet-status"
      aria-live="polite"
    >
      <div className="crash-bet-status-row">
        <span className="crash-bet-status-label">Your bet</span>
        <span className="crash-bet-status-value">{betAmountSol.toFixed(4)} SOL</span>
      </div>
      <div className="crash-bet-status-row">
        <span className="crash-bet-status-label">
          {phase === "crashed" ? "Result" : "Profit"}
        </span>
        <span
          className={`crash-bet-status-value ${
            profitPositive ? "crash-bet-status-profit" : "crash-bet-status-loss"
          }`}
        >
          {profitPositive ? "+" : ""}
          {profitSol.toFixed(4)} SOL
        </span>
      </div>
      {phase === "running" && (
        <div className="crash-bet-status-row crash-bet-status-highlight">
          <span className="crash-bet-status-label">
            {cashingOut ? "Cashing out…" : "Cash out now"}
          </span>
          <span className="crash-bet-status-value crash-bet-status-payout">
            {displayPayoutSol.toFixed(4)} SOL
          </span>
        </div>
      )}
      {phase === "crashed" && cashedOut && cashoutMultiplier !== undefined && (
        <div className="crash-bet-status-row">
          <span className="crash-bet-status-label">Cashed out</span>
          <span className="crash-bet-status-value">
            {cashoutMultiplier.toFixed(2)}×
          </span>
        </div>
      )}
    </div>
  );
}
