import { useCallback, useEffect, useState } from "react";
import { fetchHistory, formatSol, type BetHistory } from "../lib/api";
import { shortenAddress } from "../lib/utils";
import { FetchError } from "./FetchError";

interface BetHistoryPanelProps {
  walletAddress: string;
}

export function BetHistoryPanel({ walletAddress }: BetHistoryPanelProps) {
  const [history, setHistory] = useState<BetHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    fetchHistory(walletAddress)
      .then(setHistory)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [walletAddress]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="card">
      <h3 className="card-title">📜 Your Bets</h3>

      {loading ? (
        <div aria-busy="true" aria-label="Loading bet history">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      ) : error ? (
        <FetchError message={error} onRetry={load} />
      ) : history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎲</div>
          <p>No bets yet. Place your first wager!</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Bet</th>
                <th>Payout</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 10).map((bet) => (
                <tr key={bet.id}>
                  <td style={{ textTransform: "capitalize" }}>{bet.game}</td>
                  <td>{formatSol(bet.amountSol)} SOL</td>
                  <td
                    className={
                      bet.payoutSol > 0 ? "text-success" : "text-muted"
                    }
                  >
                    {formatSol(bet.payoutSol)} SOL
                  </td>
                  <td>
                    {bet.multiplier
                      ? `${bet.multiplier.toFixed(2)}x`
                      : (bet.result ?? "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="panel-hint">
        Showing last 10 bets for {shortenAddress(walletAddress)}
      </p>
    </div>
  );
}
