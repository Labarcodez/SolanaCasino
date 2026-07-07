import { AnimatedBackground } from "../components/AnimatedBackground";
import { Leaderboard } from "../components/Leaderboard";

export function ScreenshotPreviewLeaderboard() {
  return (
    <div className="app">
      <AnimatedBackground />
      <header className="header">
        <div className="container header-inner">
          <div className="logo">
            <div className="logo-icon">◎</div>
            <span>SolCasino</span>
          </div>
          <div className="header-right">
            <div className="balance-pill">
              <span className="balance-label">Balance</span>
              <span className="balance-value">1.2450 SOL</span>
            </div>
          </div>
        </div>
      </header>

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
    </div>
  );
}
