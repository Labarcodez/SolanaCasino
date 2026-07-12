import { FairnessPanel } from "./FairnessPanel";
import { useFocusTrap } from "../hooks/useFocusTrap";

export type FairnessGame = "crash" | "limbo" | "coinflip";

interface FairnessModalProps {
  open: boolean;
  onClose: () => void;
  initialGame?: FairnessGame;
}

export function FairnessModal({
  open,
  onClose,
  initialGame = "crash",
}: FairnessModalProps) {
  const dialogRef = useFocusTrap(open, onClose);

  if (!open) return null;

  return (
    <div
      className="modal-overlay fairness-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Provably fair verification"
        className="modal card fairness-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fairness-modal-header">
          <h2>Provably Fair</h2>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
            aria-label="Close fairness modal"
          >
            Close
          </button>
        </div>
        <FairnessPanel embedded initialGame={initialGame} />
      </div>
    </div>
  );
}

interface FairnessTriggerProps {
  game: FairnessGame;
  className?: string;
}

export function FairnessTrigger({ game, className = "" }: FairnessTriggerProps) {
  return (
    <button
      type="button"
      className={`btn btn-outline btn-sm fairness-trigger ${className}`.trim()}
      data-fairness-game={game}
      aria-label={`Open ${game} fairness verification`}
    >
      Fairness
    </button>
  );
}
