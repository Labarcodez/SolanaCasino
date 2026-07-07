import { PreviewShell } from "../components/PreviewShell";
import { Leaderboard } from "../components/Leaderboard";

export function ScreenshotPreviewLeaderboard() {
  return (
    <PreviewShell balanceSol="1.2450 SOL">
      <div className="container">
        <nav className="nav-tabs">
          <button type="button" className="nav-tab">🚀 Crash</button>
          <button type="button" className="nav-tab">🪙 Coinflip</button>
          <button type="button" className="nav-tab active">🏆 Leaderboard</button>
          <button type="button" className="nav-tab">🔐 Fairness</button>
          <button type="button" className="nav-tab">👤 Profile</button>
        </nav>
      </div>

      <main className="main-content">
        <div className="container game-grid">
          <Leaderboard />
        </div>
      </main>
    </PreviewShell>
  );
}
