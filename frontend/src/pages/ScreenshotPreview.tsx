/**
 * Static UI preview for documentation screenshots (no wallet required).
 */
import { AnimatedBackground } from "../components/AnimatedBackground";
import { CrashChart } from "../components/CrashChart";
import { OnChainBadge } from "../components/OnChainBadge";
import { BettingCountdown } from "../components/BettingCountdown";
import { CrashFairnessBar } from "../components/CrashFairnessBar";

const MOCK_BETS = [
  { id: "1", wallet: "7xKp...9mNq", amount: "0.05", status: "2.45x", won: true },
  { id: "2", wallet: "Ab3c...xY9z", amount: "0.10", status: "●", won: false },
  { id: "3", wallet: "Fm2h...4kLp", amount: "0.02", status: "—", won: false },
  { id: "4", wallet: "Qw8r...nT5v", amount: "0.25", status: "1.82x", won: true },
];

const MOCK_CHAT = [
  { id: "1", user: "7xKp...9mNq", text: "lets gooo 🚀" },
  { id: "2", user: "Ab3c...xY9z", text: "cashed at 3x nice" },
  { id: "3", user: "Fm2h...4kLp", text: "next round im all in" },
];

export function ScreenshotPreview() {
  const bettingEndsAt = Date.now() + 4500;

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
          <button type="button" className="nav-tab active">🚀 Crash</button>
          <button type="button" className="nav-tab">🪙 Coinflip</button>
          <button type="button" className="nav-tab">🏆 Leaderboard</button>
          <button type="button" className="nav-tab">🔐 Fairness</button>
          <div className="live-indicator" style={{ marginLeft: "auto", alignSelf: "center" }}>
            <div className="live-dot" />
            Live · 42 online
          </div>
        </nav>
      </div>

      <main className="main-content">
        <div className="container crash-page">
          <div className="crash-arena">
            <div className="crash-arena-chat">
              <div className="card chat-panel">
                <div className="chat-header">
                  <h3 className="card-title">Trollbox</h3>
                  <div className="chat-online">
                    <span className="live-dot" />
                    42 online
                  </div>
                </div>
                <div className="chat-messages">
                  {MOCK_CHAT.map((m) => (
                    <div key={m.id} className="chat-message">
                      <span className="chat-avatar">{m.user.slice(0, 1)}</span>
                      <div className="chat-bubble">
                        <span className="chat-author">{m.user}</span>
                        <span className="chat-text">{m.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="crash-arena-main">
              <div className="card card-glow crash-game-card">
                <div className="crash-header">
                  <h3 className="card-title">Crash</h3>
                  <div className="crash-header-actions">
                    <span className={`phase-badge running`}>running</span>
                  </div>
                </div>

                <div className="crash-history">
                  {["1.24x", "3.87x", "1.00x", "2.15x", "5.42x", "1.33x", "12.4x"].map((h) => (
                    <span
                      key={h}
                      className={`history-pill ${
                        parseFloat(h) < 1.5 ? "low" : parseFloat(h) < 3 ? "mid" : "high"
                      }`}
                    >
                      {h}
                    </span>
                  ))}
                </div>

                <BettingCountdown phase="running" bettingEndsAt={bettingEndsAt} />

                <CrashChart multiplier={2.45} phase="running" />

                <CrashFairnessBar
                  roundId="12847"
                  serverSeedHash="a3f8c91e2b4d6f7a8c9e0d1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
                  phase="running"
                />

                <div className="bet-controls">
                  <div className="auto-cashout">
                    <div className="auto-cashout-header">
                      <label className="auto-cashout-toggle">
                        <input type="checkbox" checked readOnly />
                        <span>Auto cashout @ 2.00x</span>
                      </label>
                    </div>
                  </div>
                  <div className="bet-actions">
                    <button type="button" className="btn btn-primary" disabled>
                      Bet locked in
                    </button>
                    <button type="button" className="btn btn-success">
                      Cash out @ 2.45x
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="crash-arena-bets">
              <div className="card live-bets-panel">
                <div className="live-bets-header">
                  <h3 className="card-title">Live Bets</h3>
                  <div className="live-bets-stats">
                    <span>4 players</span>
                    <span className="live-bets-pot">0.4200 SOL</span>
                  </div>
                </div>
                <div className="live-bets-list">
                  {MOCK_BETS.map((b) => (
                    <div
                      key={b.id}
                      className={`live-bet-row ${b.won ? "cashed-out" : ""}`}
                    >
                      <div className="live-bet-player">
                        <span className="live-bet-avatar">{b.wallet.slice(0, 1)}</span>
                        <span className="mono-cell">{b.wallet}</span>
                      </div>
                      <div className="live-bet-amount">{b.amount} SOL</div>
                      <div className="live-bet-status">
                        <span className={b.won ? "text-success" : ""}>{b.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
