import { formatSol } from "../lib/api";

interface BetAmountControlsProps {
  balanceSol: number;
  minBetSol: number;
  maxBetSol: number;
  amount: string;
  onAmountChange: (value: string) => void;
  disabled?: boolean;
  presets?: string[];
}

const DEFAULT_PRESETS = ["0.01", "0.05", "0.1", "0.5", "1"];

export function BetAmountControls({
  balanceSol,
  minBetSol,
  maxBetSol,
  amount,
  onAmountChange,
  disabled = false,
  presets = DEFAULT_PRESETS,
}: BetAmountControlsProps) {
  const adjustBet = (factor: number) => {
    const current = parseFloat(amount) || minBetSol;
    const next = Math.min(
      maxBetSol,
      Math.max(minBetSol, Math.round(current * factor * 1000) / 1000),
    );
    onAmountChange(String(next));
  };

  return (
    <>
      <div className="input-group">
        <label>Bet amount — {formatSol(balanceSol)} SOL available</label>
        <input
          className="input"
          type="number"
          step="0.001"
          min={minBetSol}
          max={maxBetSol}
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="bet-amount-presets">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            className="preset-btn"
            onClick={() => onAmountChange(preset)}
            disabled={disabled}
          >
            {preset}
          </button>
        ))}
        <button
          type="button"
          className="preset-btn"
          onClick={() => adjustBet(0.5)}
          disabled={disabled}
        >
          ½
        </button>
        <button
          type="button"
          className="preset-btn"
          onClick={() => adjustBet(2)}
          disabled={disabled}
        >
          2×
        </button>
        <button
          type="button"
          className="preset-btn"
          onClick={() =>
            onAmountChange(String(Math.min(balanceSol, maxBetSol)))
          }
          disabled={disabled}
        >
          Max
        </button>
      </div>
    </>
  );
}
