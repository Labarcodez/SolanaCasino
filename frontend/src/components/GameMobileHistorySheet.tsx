import { useState, type ReactNode } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface GameMobileHistorySheetProps {
  historyPanel: ReactNode;
}

export function GameMobileHistorySheet({
  historyPanel,
}: GameMobileHistorySheetProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useFocusTrap(open, () => setOpen(false));

  return (
    <>
      <button
        type="button"
        className="game-mobile-history-tab"
        onClick={() => setOpen(true)}
        data-testid="game-mobile-history-tab"
      >
        History
      </button>

      {open && (
        <>
          <div
            className="crash-sheet-overlay"
            onClick={() => setOpen(false)}
            role="presentation"
          />
          <div
            ref={dialogRef}
            className="crash-bottom-sheet game-history-sheet"
            role="dialog"
            aria-label="Transaction history"
            data-testid="game-history-sheet"
          >
            <div className="crash-bottom-sheet-header">
              <h3>Transaction history</h3>
              <button
                type="button"
                className="btn-ghost crash-bottom-sheet-close"
                onClick={() => setOpen(false)}
                aria-label="Close history"
              >
                ×
              </button>
            </div>
            <div className="crash-bottom-sheet-body">{historyPanel}</div>
          </div>
        </>
      )}
    </>
  );
}
