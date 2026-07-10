interface GameActionSpinnerProps {
  label?: string;
}

export function GameActionSpinner({ label = "Loading..." }: GameActionSpinnerProps) {
  return (
    <div className="game-action-spinner" aria-busy="true" aria-label={label}>
      <div className="game-action-spinner-ring" />
      <span>{label}</span>
    </div>
  );
}
