import { useEffect, useState } from "react";
import { useCasino } from "../hooks/CasinoUserProvider";
import {
  fetchAdminDashboard,
  setCasinoPaused,
  type AdminDashboard,
} from "../lib/api";
import { useToast } from "./ui/Toast";
import { PageHeader } from "./PageHeader";

export function AdminDashboard() {
  const { walletAddress } = useCasino();
  const { toast } = useToast();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [pausing, setPausing] = useState(false);

  const load = async () => {
    try {
      const dashboard = await fetchAdminDashboard();
      setData(dashboard);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Admin load failed", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const togglePause = async () => {
    if (!data) return;
    setPausing(true);
    try {
      await setCasinoPaused(!data.casinoPaused);
      toast(data.casinoPaused ? "Casino resumed" : "Casino paused", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Pause toggle failed", "error");
    } finally {
      setPausing(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="spinner" />
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <p>Admin access denied or unavailable.</p>
      </div>
    );
  }

  return (
    <div className="card card-glow admin-dashboard">
      <PageHeader
        title="Admin Dashboard"
        subtitle={`Operator controls · ${walletAddress?.slice(0, 8)}...`}
      />

      <div className="admin-stats-grid">
        <div className="admin-stat">
          <span className="admin-stat-label">24h Handle</span>
          <span className="admin-stat-value">{data.handle24hSol.toFixed(4)} SOL</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-label">24h Gross</span>
          <span className="admin-stat-value">{data.grossRevenue24hSol.toFixed(4)} SOL</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-label">Users</span>
          <span className="admin-stat-value">{data.totalUsers}</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-label">Total Bets</span>
          <span className="admin-stat-value">{data.totalBets}</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-label">Tournament Pool</span>
          <span className="admin-stat-value">{data.tournamentPrizePoolSol.toFixed(4)} SOL</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-label">Indexed On-Chain</span>
          <span className="admin-stat-value">{data.indexer.indexedBets}</span>
        </div>
      </div>

      <div className="admin-controls">
        <div className="admin-control-row">
          <div>
            <strong>Casino Status</strong>
            <p className="text-muted">
              {data.casinoPaused ? "Paused — no new bets" : "Live — accepting bets"}
            </p>
          </div>
          <button
            type="button"
            className={`btn ${data.casinoPaused ? "btn-success" : "btn-danger"}`}
            onClick={() => void togglePause()}
            disabled={pausing || !data.onChainEnabled}
          >
            {data.casinoPaused ? "Resume Casino" : "Pause Casino"}
          </button>
        </div>

        <div className="admin-control-row">
          <div>
            <strong>Withdrawals</strong>
            <p className="text-muted">
              {data.withdrawalsEnabled ? "Enabled" : "Queued mode"}
            </p>
          </div>
          <span className="badge">{data.pendingWithdrawals.length} pending</span>
        </div>
      </div>

      {data.pendingWithdrawals.length > 0 && (
        <div className="admin-withdrawals">
          <h4>Pending Withdrawals</h4>
          <div className="admin-table">
            {data.pendingWithdrawals.map((w) => (
              <div key={w.id} className="admin-table-row">
                <span className="mono-cell">{w.walletAddress.slice(0, 8)}...</span>
                <span>{w.amountSol.toFixed(4)} SOL</span>
                <span className="text-muted">{new Date(w.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
