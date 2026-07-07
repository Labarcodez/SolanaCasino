import { useEffect, useState } from "react";
import { fetchLeaderboard, type LeaderboardEntry } from "../lib/api";
import { formatSol } from "../lib/api";

export function Leaderboard() {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    fetchLeaderboard()
      .then(setLeaders)
      .catch(console.error);
    const interval = setInterval(() => {
      fetchLeaderboard().then(setLeaders).catch(console.error);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getRankClass = (rank: number) => {
    if (rank === 1) return "gold";
    if (rank === 2) return "silver";
    if (rank === 3) return "bronze";
    return "";
  };

  return (
    <div className="card">
      <h3 className="card-title">🏆 Leaderboard</h3>
      {leaders.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          No players yet. Be the first!
        </p>
      ) : (
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
                  ) :
                    l.rank
                  }
                </td>
                <td>{l.walletAddress}</td>
                <td>{formatSol(l.totalWageredSol)} SOL</td>
                <td style={{ color: "var(--solana-green)" }}>
                  {formatSol(l.totalWonSol)} SOL
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
