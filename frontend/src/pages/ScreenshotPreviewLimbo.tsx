import { PreviewShell } from "../components/PreviewShell";
import { PageHeader } from "../components/PageHeader";

export function ScreenshotPreviewLimbo() {
  return (
    <PreviewShell onChain balanceSol="2.4500 SOL">
      <div className="container">
        <nav className="nav-tabs">
          <button type="button" className="nav-tab">🚀 Crash</button>
          <button type="button" className="nav-tab">🪙 Coinflip</button>
          <button type="button" className="nav-tab active">🎯 Limbo</button>
          <button type="button" className="nav-tab">⚔️ Tournament</button>
        </nav>
      </div>

      <main className="main-content">
        <div className="container game-grid">
          <div className="card card-glow">
            <PageHeader
              title="Limbo"
              subtitle="Set your target multiplier — beat the roll to win"
            />
            <div className="limbo-display">
              <div className="limbo-roll limbo-roll-win">2.47x</div>
              <p className="limbo-result-text">You won 0.0494 SOL!</p>
            </div>
            <div className="input-group">
              <label>Bet Amount (SOL)</label>
              <input className="input" type="text" value="0.02" readOnly />
            </div>
            <div className="input-group">
              <label>Target Multiplier</label>
              <input className="input" type="text" value="2.00" readOnly />
            </div>
            <div className="limbo-stats">
              <span>Win chance: 49.0%</span>
              <span>Potential: 0.0400 SOL</span>
            </div>
            <div className="bet-amount-presets">
              {["1.5", "2", "3", "5", "10"].map((p) => (
                <button key={p} type="button" className="preset-btn">{p}x</button>
              ))}
            </div>
            <button type="button" className="btn btn-primary" style={{ width: "100%", marginTop: 16 }}>
              Play Limbo
            </button>
          </div>
          <aside className="sidebar-panels">
            <div className="card">
              <PageHeader title="95% RTP" subtitle="5% house edge · 2× min target" />
              <p className="text-muted">Provably fair rolls verified on-chain.</p>
            </div>
          </aside>
        </div>
      </main>
    </PreviewShell>
  );
}
