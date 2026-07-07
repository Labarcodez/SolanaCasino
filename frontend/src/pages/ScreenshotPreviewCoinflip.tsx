export function ScreenshotPreviewCoinflip() {
  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <div className="logo">
            <span className="logo-icon">🎰</span>
            <span>SolCasino</span>
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
          <button className="nav-tab">🚀 Crash</button>
          <button className="nav-tab active">🪙 Coinflip</button>
          <button className="nav-tab">🏆 Leaderboard</button>
          <button className="nav-tab">🔐 Fairness</button>
        </nav>
      </div>

      <main className="main-content">
        <div className="container game-grid">
          <div className="card">
            <h3 className="card-title">🪙 Coinflip (On-Chain)</h3>
            <div className="coinflip-container">
              <div className="coin">👑</div>
              <div className="choice-buttons">
                <button className="choice-btn selected">👑 Heads</button>
                <button className="choice-btn">🦅 Tails</button>
              </div>
              <div className="input-group">
                <label>Bet Amount (SOL) — Balance: 1.2450</label>
                <input className="input" type="text" value="0.01" readOnly />
              </div>
              <button className="btn btn-primary" style={{ width: "100%" }}>
                Flip for 0.01 SOL
              </button>
              <div className="alert alert-success" style={{ marginTop: 16 }}>
                You won 0.0190 SOL!
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">🔐 Provably Fair</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Coinflip uses commit-reveal seeds verified on-chain. Server seed hash is
              committed before your bet; the seed is revealed in the same transaction.
            </p>
            <div style={{ marginTop: 16, fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              <div>server_seed_hash: a3f8...9c2d</div>
              <div style={{ marginTop: 4 }}>client_seed: 7b2e...4f1a</div>
              <div style={{ marginTop: 4 }}>program: Be5brMe2...C41vU</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
