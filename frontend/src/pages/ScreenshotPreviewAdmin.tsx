import { PreviewShell } from "../components/PreviewShell";
import { PageHeader } from "../components/PageHeader";

export function ScreenshotPreviewAdmin() {
  return (
    <PreviewShell onChain balanceSol="Admin">
      <div className="container">
        <nav className="nav-tabs">
          <button type="button" className="nav-tab">🚀 Crash</button>
          <button type="button" className="nav-tab active">⚙️ Admin</button>
        </nav>
      </div>

      <main className="main-content">
        <div className="container">
          <div className="card card-glow admin-dashboard">
            <PageHeader
              title="Admin Dashboard"
              subtitle="Operator controls · FMmho438..."
            />
            <div className="admin-stats-grid">
              <div className="admin-stat">
                <span className="admin-stat-label">24h Handle</span>
                <span className="admin-stat-value">128.4500 SOL</span>
              </div>
              <div className="admin-stat">
                <span className="admin-stat-label">24h Gross</span>
                <span className="admin-stat-value">6.4225 SOL</span>
              </div>
              <div className="admin-stat">
                <span className="admin-stat-label">Users</span>
                <span className="admin-stat-value">1,247</span>
              </div>
              <div className="admin-stat">
                <span className="admin-stat-label">Total Bets</span>
                <span className="admin-stat-value">8,932</span>
              </div>
              <div className="admin-stat">
                <span className="admin-stat-label">Tournament Pool</span>
                <span className="admin-stat-value">3.2500 SOL</span>
              </div>
              <div className="admin-stat">
                <span className="admin-stat-label">Indexed On-Chain</span>
                <span className="admin-stat-value">4,521</span>
              </div>
            </div>
            <div className="admin-controls">
              <div className="admin-control-row">
                <div>
                  <strong>Casino Status</strong>
                  <p className="text-muted">Live — accepting bets</p>
                </div>
                <button type="button" className="btn btn-danger">Pause Casino</button>
              </div>
              <div className="admin-control-row">
                <div>
                  <strong>Withdrawals</strong>
                  <p className="text-muted">Enabled</p>
                </div>
                <span className="badge">3 pending</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </PreviewShell>
  );
}
