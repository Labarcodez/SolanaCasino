interface CrashAutoBetControlProps {
  slotLabel: "A" | "B";
  enabled: boolean;
  rounds: string;
  stopProfitSol: string;
  stopLossSol: string;
  sessionPnlSol?: number;
  roundsRemaining: number | null;
  showSessionPnl?: boolean;
  disabled?: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onRoundsChange: (value: string) => void;
  onStopProfitChange: (value: string) => void;
  onStopLossChange: (value: string) => void;
}

export function CrashAutoBetControl({
  slotLabel,
  enabled,
  rounds,
  stopProfitSol,
  stopLossSol,
  sessionPnlSol = 0,
  roundsRemaining,
  showSessionPnl = false,
  disabled,
  onEnabledChange,
  onRoundsChange,
  onStopProfitChange,
  onStopLossChange,
}: CrashAutoBetControlProps) {
  return (
    <div
      className="crash-auto-bet"
      data-testid={`crash-auto-bet-${slotLabel.toLowerCase()}`}
    >
      <div className="crash-auto-bet-header">
        <label className="auto-cashout-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            disabled={disabled}
          />
          <span>Auto-bet (Bet {slotLabel})</span>
        </label>
        {enabled && (
          <span className="crash-auto-bet-remaining">
            {roundsRemaining === null
              ? "∞"
              : `${Math.max(0, roundsRemaining)} left`}
          </span>
        )}
      </div>

      {enabled && (
        <div className="crash-auto-bet-fields">
          <div className="crash-auto-bet-row">
            <label>
              Rounds
              <input
                className="input"
                type="number"
                min="0"
                max="500"
                step="1"
                value={rounds}
                onChange={(e) => onRoundsChange(e.target.value)}
                disabled={disabled}
                placeholder="0 = unlimited"
              />
            </label>
            <label>
              Stop profit (SOL)
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={stopProfitSol}
                onChange={(e) => onStopProfitChange(e.target.value)}
                disabled={disabled}
                placeholder="Optional"
              />
            </label>
            <label>
              Stop loss (SOL)
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={stopLossSol}
                onChange={(e) => onStopLossChange(e.target.value)}
                disabled={disabled}
                placeholder="Optional"
              />
            </label>
          </div>
          {showSessionPnl && (
            <p className="crash-auto-bet-pnl">
              Session PnL:{" "}
              <span
                className={
                  sessionPnlSol >= 0 ? "text-success" : "text-danger"
                }
              >
                {sessionPnlSol >= 0 ? "+" : ""}
                {sessionPnlSol.toFixed(4)} SOL
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
