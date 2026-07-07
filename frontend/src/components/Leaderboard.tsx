import { useCallback, useEffect, useState } from "react";
import {
  fetchLeaderboard,
  formatSol,
  type LeaderboardEntry,
} from "../lib/api";
import { PageHeader } from "./PageHeader";
import { FetchError } from "./FetchError";

export function Leaderboard() {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    fetchLeaderboard()
      .then(setLeaders)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const getRankClass = (rank: number) => {
    if (rank === 1) return "gold";
    if (rank === 2) return "silver";
    if (rank === 3) return "bronze";
    return "";
  };

  return (
    <div className="card">
      <PageHeader
        title="Leaderboard"
        subtitle="Top players by total wagered. Updates every 30 seconds."
      />

      {loading ? (
        <div aria-busy="true" aria-label="Loading leaderboard">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      ) : error ? (
        <FetchError message={error} onRetry={load} />
      ) : leaders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏆</div>
          <p>No players yet. Be the first on the board!</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Wagered</th>
                <th>Won</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((l) => (
                <tr key={l.rank}>
                  <td>
                    {l.rank <= 3 ? (
                      <span className={`rank-badge ${getRankClass(l.rank)}`}>
                        {l.rank}
                      </span>
                    ) : (
                      l.rank
                    )}
                  </td>
                  <td className="mono-cell">{l.displayName}</td>
                  <td>{formatSol(l.totalWageredSol)} SOL</td>
                  <td className="text-success">
                    {formatSol(l.totalWonSol)} SOL
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
