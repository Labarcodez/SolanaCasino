import { AnimatedBackground } from "../components/AnimatedBackground";
import { OnChainBadge } from "../components/OnChainBadge";

export function ScreenshotPreviewCoinflip() {
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
            <div className="wallet-chip">7xKp...9mNq</div>
          </div>
        </div>
      </header>

      <div className="container">
        <nav className="nav-tabs">
          <button type="button" className="nav-tab">
            🚀 Crash
          </button>
          <button type="button" className="nav-tab active">
            🪙 Coinflip
          </button>
          <button type="button" className="nav-tab">
            🏆 Leaderboard
          </button>
          <button type="button" className="nav-tab">
            🔐 Fairness
          </button>
        </nav>
      </div>

      <main className="main-content">
        <div className="container game-grid">
          <div className="card">
            <h3 className="card-title">🪙 Coinflip</h3>
            <div className="coinflip-container">
              <div className="coin coin-heads">👑</div>
              <div className="choice-buttons">
                <button type="button" className="choice-btn selected">
                  👑 Heads
                </button>
                <button type="button" className="choice-btn">
                  🦅 Tails
                </button>
              </div>
              <div className="input-group">
                <label>Bet Amount (SOL) — Balance: 1.2450</label>
                <input className="input" type="text" value="0.01" readOnly />
              </div>
              <button type="button" className="btn btn-primary" style={{ width: "100%" }}>
                Flip for 0.01 SOL
              </button>
              <div className="alert alert-success" style={{ marginTop: 16 }}>
                You won 0.0190 SOL!
              </div>
              <p className="coinflip-fairness-note">
                Commit-reveal seeds verified on-chain. Server seed hash is committed
                before your bet; the seed is revealed in the same transaction.
              </p>
            </div>
          </div>

          <aside className="sidebar-panels">
            <div className="card">
              <h3 className="card-title">🔐 Provably Fair</h3>
              <p className="panel-subtitle">
                Every flip uses cryptographic seeds you can verify after the round.
              </p>
              <div className="fairness-seed-box">server_seed_hash: a3f8c91e...9c2d4b7f</div>
              <div className="fairness-seed-box" style={{ marginTop: 8 }}>
                client_seed: 7b2e5a1c...4f1a8d3e
              </div>
              <div className="fairness-seed-box" style={{ marginTop: 8 }}>
                program: Be5brMe2AvA68zEdiFKxa6KfYJdeQAeY12eWtZiC41vU
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
