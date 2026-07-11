import { useCallback, useEffect, useState } from "react";
import {
  fetchTransactions,
  formatSol,
  type TransactionRecord,
  type TransactionType,
} from "../lib/api";
import { solscanTxUrl } from "../lib/utils";
import { FetchError } from "./FetchError";

type FilterType = "all" | TransactionType;

interface TransactionHistoryPanelProps {
  walletAddress: string;
}

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bet", label: "Bets" },
  { id: "deposit", label: "Deposits" },
  { id: "withdrawal", label: "Withdrawals" },
];

function typeLabel(type: TransactionType): string {
  if (type === "bet") return "Bet";
  if (type === "deposit") return "Deposit";
  return "Withdrawal";
}

export function TransactionHistoryPanel({
  walletAddress,
}: TransactionHistoryPanelProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [items, setItems] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    fetchTransactions(walletAddress, filter === "all" ? undefined : filter)
      .then(setItems)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, [walletAddress, filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="card transaction-history-panel" data-testid="transaction-history-panel">
      <div className="transaction-history-header">
        <h3 className="card-title">Transaction history</h3>
        <div className="transaction-history-filters" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`btn btn-sm ${filter === f.id ? "btn-primary" : "btn-outline"}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div aria-busy="true" aria-label="Loading transactions">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      ) : error ? (
        <FetchError message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>No transactions yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Detail</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tx) => (
                <tr key={`${tx.type}-${tx.id}`}>
                  <td>{typeLabel(tx.type)}</td>
                  <td>
                    {tx.type === "bet" ? (
                      <>
                        {formatSol(tx.amountSol)} →{" "}
                        <span
                          className={
                            (tx.payoutSol ?? 0) > tx.amountSol
                              ? "text-success"
                              : "text-muted"
                          }
                        >
                          {formatSol(tx.payoutSol ?? 0)}
                        </span>
                      </>
                    ) : (
                      <span
                        className={
                          tx.type === "deposit" ? "text-success" : ""
                        }
                      >
                        {tx.type === "deposit" ? "+" : "−"}
                        {formatSol(tx.amountSol)} SOL
                      </span>
                    )}
                  </td>
                  <td>
                    {tx.type === "bet" && (
                      <span style={{ textTransform: "capitalize" }}>
                        {tx.game}
                        {tx.multiplier
                          ? ` · ${tx.multiplier.toFixed(2)}x`
                          : ""}
                      </span>
                    )}
                    {tx.type !== "bet" && tx.signature && (
                      <a
                        href={solscanTxUrl(tx.signature)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Solscan
                      </a>
                    )}
                    {tx.type !== "bet" && tx.status && tx.status !== "complete" && (
                      <span className="text-muted"> · {tx.status}</span>
                    )}
                  </td>
                  <td className="text-muted">
                    {new Date(tx.createdAt).toLocaleString()}
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
