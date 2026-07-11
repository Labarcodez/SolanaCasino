import { useState, type ReactNode } from "react";

interface CrashMobilePanelsProps {
  chatPanel: ReactNode;
  betsPanel: ReactNode;
}

type Sheet = "chat" | "bets" | null;

export function CrashMobilePanels({
  chatPanel,
  betsPanel,
}: CrashMobilePanelsProps) {
  const [sheet, setSheet] = useState<Sheet>(null);

  return (
    <>
      <div className="crash-mobile-tabs" data-testid="crash-mobile-tabs">
        <button
          type="button"
          className={`crash-mobile-tab ${sheet === "chat" ? "active" : ""}`}
          onClick={() => setSheet((s) => (s === "chat" ? null : "chat"))}
          data-testid="crash-mobile-chat-tab"
        >
          Chat
        </button>
        <button
          type="button"
          className={`crash-mobile-tab ${sheet === "bets" ? "active" : ""}`}
          onClick={() => setSheet((s) => (s === "bets" ? null : "bets"))}
          data-testid="crash-mobile-bets-tab"
        >
          Live bets
        </button>
      </div>

      {sheet && (
        <>
          <div
            className="crash-sheet-overlay"
            onClick={() => setSheet(null)}
            role="presentation"
            data-testid="crash-sheet-overlay"
          />
          <div
            className="crash-bottom-sheet"
            role="dialog"
            aria-label={sheet === "chat" ? "Live chat" : "Live bets"}
            data-testid="crash-bottom-sheet"
          >
            <div className="crash-bottom-sheet-header">
              <h3>{sheet === "chat" ? "Live Chat" : "Live Bets"}</h3>
              <button
                type="button"
                className="btn-ghost crash-bottom-sheet-close"
                onClick={() => setSheet(null)}
                aria-label="Close panel"
              >
                ×
              </button>
            </div>
            <div className="crash-bottom-sheet-body">
              {sheet === "chat" ? chatPanel : betsPanel}
            </div>
          </div>
        </>
      )}
    </>
  );
}
