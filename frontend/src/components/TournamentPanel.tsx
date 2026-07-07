import { useEffect, useState } from "react";
import { fetchTournament, type TournamentData } from "../lib/api";
import { PageHeader } from "./PageHeader";

export function TournamentPanel() {
  const [data, setData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournament()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
    const interval = setInterval(() => {
      fetchTournament().then(setData).catch(console.error);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const endsIn = data
    ? Math.max(0, new Date(data.weekEnd).getTime() - Date.now())
    : 0;
  const daysLeft = Math.floor(endsIn / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((endsIn % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return (
    <div className="card tournament-panel">
      <PageHeader
        title="Weekly Tournament"
        subtitle="Top wagerers split the prize pool — 1% of all bets feeds the pool"
      />

      {loading ? (
        <div className="skeleton skeleton-row" />
      ) : data ? (
        <>
          <div className="tournament-hero">
            <div className="tournament-prize">
              <span className="tournament-prize-value">
                {data.prizePoolSol.toFixed(4)} SOL
              </span>
              <span className="tournament-prize-label">Prize pool</span>
            </div>
            <div className="tournament-timer">
              <span className="tournament-timer-value">
                {daysLeft}d {hoursLeft}h
              </span>
              <span className="tournament-timer-label">Remaining</span>
            </div>
          </div>

          {data.entries.length === 0 ? (
            <div className="empty-state">
              <p>No entries yet. Place bets to join the race!</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Wagered</th>
                    <th>Est. prize</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e) => (
                    <tr key={e.rank}>
                      <td>{e.rank}</td>
                      <td>{e.displayName}</td>
                      <td>{e.wageredSol.toFixed(4)} SOL</td>
                      <td className="text-success">
                        {e.estimatedPrizeSol.toFixed(4)} SOL
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
