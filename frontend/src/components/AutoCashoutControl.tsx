interface AutoCashoutControlProps {
  enabled: boolean;
  value: string;
  onEnabledChange: (enabled: boolean) => void;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

const PRESETS = ["1.5", "2", "3", "5", "10"];

export function AutoCashoutControl({
  enabled,
  value,
  onEnabledChange,
  onValueChange,
  disabled,
}: AutoCashoutControlProps) {
  return (
    <div className="auto-cashout">
      <div className="auto-cashout-header">
        <label className="auto-cashout-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            disabled={disabled}
          />
          <span>Auto cashout</span>
        </label>
      </div>

      {enabled && (
        <>
          <div className="input-group" style={{ marginTop: 8 }}>
            <label>Target multiplier</label>
            <input
              className="input"
              type="number"
              step="0.01"
              min="1.01"
              max="1000"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="bet-amount-presets">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="preset-btn"
                onClick={() => onValueChange(preset)}
                disabled={disabled}
              >
                {preset}x
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
