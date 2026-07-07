import { PreviewShell } from "../components/PreviewShell";
import { PageHeader } from "../components/PageHeader";

export function ScreenshotPreviewCoinflip() {
  return (
    <PreviewShell onChain balanceSol="1.2450 SOL">
      <div className="container">
        <nav className="nav-tabs">
          <button type="button" className="nav-tab">🚀 Crash</button>
          <button type="button" className="nav-tab active">🪙 Coinflip</button>
          <button type="button" className="nav-tab">🏆 Leaderboard</button>
          <button type="button" className="nav-tab">🔐 Fairness</button>
        </nav>
      </div>

      <main className="main-content">
        <div className="container game-grid">
          <div className="card">
            <PageHeader
              title="Coinflip"
              subtitle="Instant 50/50 flips with commit-reveal fairness."
            />
            <div className="coinflip-container">
              <div className="coin coin-heads">👑</div>
              <div className="choice-buttons">
                <button type="button" className="choice-btn selected">👑 Heads</button>
                <button type="button" className="choice-btn">🦅 Tails</button>
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
              <PageHeader
                title="Provably Fair"
                subtitle="Every flip uses cryptographic seeds you can verify after the round."
              />
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
    </PreviewShell>
  );
}
