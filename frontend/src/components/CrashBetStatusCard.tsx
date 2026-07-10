import type { CrashPhase } from "../hooks/useSocket";

interface CrashBetStatusCardProps {
  betAmountSol: number;
  multiplier: number;
  phase: CrashPhase;
  visible: boolean;
  cashingOut?: boolean;
}

export function CrashBetStatusCard({
  betAmountSol,
  multiplier,
  phase,
  visible,
  cashingOut = false,
}: CrashBetStatusCardProps) {
  if (!visible || phase === "betting" || phase === "cooldown") return null;

  const payoutSol = betAmountSol * multiplier;
  const profitSol = payoutSol - betAmountSol;
  const profitPositive = profitSol >= 0;

  return (
    <div
      className={`crash-bet-status ${cashingOut ? "crash-bet-status--pending" : ""}`}
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
            {payoutSol.toFixed(4)} SOL
          </span>
        </div>
      )}
    </div>
  );
}
