import { AnimatedBackground } from "../components/AnimatedBackground";
import { OnChainBadge } from "../components/OnChainBadge";
import { ProfilePanel } from "../components/ProfilePanel";

const MOCK_PROFILE = {
  walletAddress: "7xKp9mNqAb3cFm2hxY9zQw8r4kLpTn5v",
  displayName: "DegenKing",
  email: "player@gmail.com",
  authProvider: "google",
  balanceSol: 1.245,
  balanceLamports: 1245000000,
  onChainBalanceSol: 2.5,
  totalWageredSol: 12.84,
  totalWonSol: 8.32,
  memberSince: "2026-01-15T10:00:00.000Z",
  onChainEnabled: true,
};

export function ScreenshotPreviewProfile() {
  return (
    <div className="app">
      <AnimatedBackground />
      <header className="header">
        <div className="container header-inner">
          <div className="logo">
            <div className="logo-icon">◎</div>
            <span>SolCasino</span>
            <OnChainBadge enabled />
          </div>
          <div className="header-right">
            <div className="balance-pill">
              <span className="balance-label">Balance</span>
              <span className="balance-value">1.2450 SOL</span>
            </div>
            <button type="button" className="profile-chip">
              <span
                className="profile-avatar"
                style={{
                  width: 28,
                  height: 28,
                  background: "linear-gradient(135deg, #9945ff, #14f195)",
                  fontSize: "0.7rem",
                }}
              >
                DK
              </span>
              <span className="profile-chip-name">DegenKing</span>
              <span className="profile-chip-wallet">7xKp...9mNq</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container">
        <nav className="nav-tabs">
          <button type="button" className="nav-tab">🚀 Crash</button>
          <button type="button" className="nav-tab">🪙 Coinflip</button>
          <button type="button" className="nav-tab">🏆 Leaderboard</button>
          <button type="button" className="nav-tab">🔐 Fairness</button>
          <button type="button" className="nav-tab active">👤 Profile</button>
        </nav>
      </div>

      <main className="main-content">
        <div className="container game-grid">
          <ProfilePanel
            profile={MOCK_PROFILE}
            onUpdated={() => undefined}
          />
        </div>
      </main>
    </div>
  );
}
