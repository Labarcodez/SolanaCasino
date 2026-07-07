import { useEffect, useState } from "react";
import { fetchHistory, type BetHistory } from "../lib/api";
import { formatSol } from "../lib/api";

interface BetHistoryPanelProps {
  walletAddress: string;
}

export function BetHistoryPanel({ walletAddress }: BetHistoryPanelProps) {
  const [history, setHistory] = useState<BetHistory[]>([]);

  useEffect(() => {
    fetchHistory(walletAddress)
      .then(setHistory)
      .catch(console.error);
  }, [walletAddress]);

  return (
    <div className="card">
      <h3 className="card-title">📜 Your Bets</h3>
      {history.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          No bets yet. Start playing!
        </p>
      ) : (
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
                  style={{
                    color:
                      bet.payoutSol > 0
                        ? "var(--solana-green)"
                        : "var(--text-muted)",
                  }}
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
      )}
    </div>
  );
}
