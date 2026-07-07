import { PreviewShell } from "../components/PreviewShell";
import { FairnessPanel } from "../components/FairnessPanel";
import { SocketProvider } from "../hooks/useSocket";

export function ScreenshotPreviewFairness() {
  return (
    <SocketProvider enabled={false}>
      <PreviewShell>
        <div className="container">
          <nav className="nav-tabs">
            <button type="button" className="nav-tab">🚀 Crash</button>
            <button type="button" className="nav-tab">🪙 Coinflip</button>
            <button type="button" className="nav-tab">🏆 Leaderboard</button>
            <button type="button" className="nav-tab active">🔐 Fairness</button>
            <button type="button" className="nav-tab">👤 Profile</button>
          </nav>
        </div>

        <main className="main-content">
          <div className="container game-grid">
            <FairnessPanel />
          </div>
        </main>
      </PreviewShell>
    </SocketProvider>
  );
}
