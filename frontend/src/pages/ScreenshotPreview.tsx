/**
 * Static UI preview for documentation screenshots (no wallet required).
 */
export function ScreenshotPreview() {
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
          <button className="nav-tab active">🚀 Crash</button>
          <button className="nav-tab">🪙 Coinflip</button>
          <button className="nav-tab">🏆 Leaderboard</button>
          <button className="nav-tab">🔐 Fairness</button>
          <div className="live-indicator" style={{ marginLeft: "auto", alignSelf: "center" }}>
            <div className="live-dot" />
            Live
          </div>
        </nav>
      </div>

      <main className="main-content">
        <div className="container game-grid">
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 className="card-title" style={{ margin: 0 }}>🚀 Crash (On-Chain)</h3>
              <span className="phase-badge running">running</span>
            </div>

            <div className="crash-history">
              {["1.24x", "3.87x", "1.00x", "2.15x", "5.42x", "1.33x"].map((h) => (
                <span key={h} className={`history-pill ${parseFloat(h) < 1.5 ? "low" : parseFloat(h) < 3 ? "mid" : "high"}`}>
                  {h}
                </span>
              ))}
            </div>

            <div className="crash-display">
              <div className="crash-rocket" style={{ bottom: "45%" }}>🚀</div>
              <div className="crash-multiplier running">2.45x</div>
            </div>

            <div className="bet-controls" style={{ marginTop: 24 }}>
              <div className="input-group">
                <label>Bet Amount (SOL) — Balance: 1.2450</label>
                <input className="input" type="text" value="0.05" readOnly />
              </div>
              <div className="bet-amount-presets">
                {["0.01", "0.05", "0.1", "0.5"].map((p) => (
                  <button key={p} className="preset-btn">{p}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled>Bet Placed</button>
                <button className="btn btn-success" style={{ flex: 1 }}>Cash Out @ 2.45x</button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div className="card">
              <h3 className="card-title">💰 Wallet</h3>
              <div className="wallet-stats">
                <div className="stat">
                  <span className="stat-label">Casino Balance</span>
                  <span className="stat-value">1.2450 SOL</span>
                </div>
                <div className="stat">
                  <span className="stat-label">On-Chain SOL</span>
                  <span className="stat-value">2.5000 SOL</span>
                </div>
              </div>
              <div className="input-group">
                <label>Amount (SOL)</label>
                <input className="input" type="text" value="0.1" readOnly />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button className="btn btn-primary" style={{ flex: 1 }}>Deposit</button>
                <button className="btn btn-secondary" style={{ flex: 1 }}>Withdraw</button>
              </div>
              <p style={{ marginTop: 12, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                On-chain mode: deposits go to vault PDA via Anchor program
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">📜 Recent Bets</h3>
              <div className="history-list">
                {[
                  { game: "crash", amount: "0.05", payout: "0.12", result: "win" },
                  { game: "coinflip", amount: "0.01", payout: "0", result: "loss" },
                  { game: "crash", amount: "0.10", payout: "0", result: "loss" },
                ].map((b, i) => (
                  <div key={i} className="history-item">
                    <span>{b.game === "crash" ? "🚀" : "🪙"} {b.game}</span>
                    <span>{b.amount} SOL</span>
                    <span className={b.result === "win" ? "text-success" : "text-danger"}>
                      {b.result === "win" ? `+${b.payout}` : `-${b.amount}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
