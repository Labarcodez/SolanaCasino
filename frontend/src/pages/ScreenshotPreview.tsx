/**
 * Static UI preview for documentation screenshots (no wallet required).
 */
import { AnimatedBackground } from "../components/AnimatedBackground";
import { CrashChart } from "../components/CrashChart";
import { OnChainBadge } from "../components/OnChainBadge";

export function ScreenshotPreview() {
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
          <button type="button" className="nav-tab active">
            🚀 Crash
          </button>
          <button type="button" className="nav-tab">
            🪙 Coinflip
          </button>
          <button type="button" className="nav-tab">
            🏆 Leaderboard
          </button>
          <button type="button" className="nav-tab">
            🔐 Fairness
          </button>
          <div
            className="live-indicator"
            style={{ marginLeft: "auto", alignSelf: "center" }}
          >
            <div className="live-dot" />
            Live
          </div>
        </nav>
      </div>

      <main className="main-content">
        <div className="container game-grid">
          <div className="card">
            <div className="crash-header">
              <h3 className="card-title">🚀 Crash</h3>
              <span className="phase-badge running">running</span>
            </div>

            <div className="crash-history">
              {["1.24x", "3.87x", "1.00x", "2.15x", "5.42x", "1.33x"].map((h) => (
                <span
                  key={h}
                  className={`history-pill ${
                    parseFloat(h) < 1.5
                      ? "low"
                      : parseFloat(h) < 3
                        ? "mid"
                        : "high"
                  }`}
                >
                  {h}
                </span>
              ))}
            </div>

            <CrashChart multiplier={2.45} phase="running" />

            <div className="bet-controls" style={{ marginTop: 24 }}>
              <div className="input-group">
                <label>Bet Amount (SOL) — Balance: 1.2450</label>
                <input className="input" type="text" value="0.05" readOnly />
              </div>
              <div className="bet-amount-presets">
                {["0.01", "0.05", "0.1", "0.5"].map((p) => (
                  <button key={p} type="button" className="preset-btn">
                    {p}
                  </button>
                ))}
              </div>
              <div className="bet-actions">
                <button type="button" className="btn btn-primary" disabled>
                  Bet Placed
                </button>
                <button type="button" className="btn btn-success">
                  Cash Out @ 2.45x
                </button>
              </div>
            </div>
          </div>

          <aside className="sidebar-panels">
            <div className="card wallet-panel">
              <h3 className="card-title">Wallet</h3>
              <div className="wallet-stats">
                <div className="stat-box">
                  <div className="label">Casino</div>
                  <div className="value" style={{ color: "var(--solana-green)" }}>
                    1.2450
                  </div>
                </div>
                <div className="stat-box">
                  <div className="label">Wallet SOL</div>
                  <div className="value">2.5000</div>
                </div>
              </div>
              <div className="wallet-mode-toggle">
                <button type="button" className="btn btn-sm btn-primary">
                  Deposit
                </button>
                <button type="button" className="btn btn-sm btn-outline">
                  Withdraw
                </button>
              </div>
              <p className="wallet-hint">
                On-chain mode: funds go to the vault PDA via Anchor program.
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">📜 Your Bets</h3>
              <div className="history-list">
                {[
                  { game: "crash", amount: "0.05", payout: "0.12", win: true },
                  { game: "coinflip", amount: "0.01", payout: "0", win: false },
                  { game: "crash", amount: "0.10", payout: "0", win: false },
                ].map((b, i) => (
                  <div key={i} className="history-item">
                    <span>
                      {b.game === "crash" ? "🚀" : "🪙"} {b.game}
                    </span>
                    <span>{b.amount} SOL</span>
                    <span className={b.win ? "text-success" : "text-danger"}>
                      {b.win ? `+${b.payout}` : `-${b.amount}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
