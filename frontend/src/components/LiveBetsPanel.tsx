import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { formatSol } from "../lib/api";
import type { CrashBetView } from "../hooks/useSocket";

interface LiveBetsPanelProps {
  bets: CrashBetView[];
  phase: string;
}

export function LiveBetsPanel({
  bets,
  phase,
}: LiveBetsPanelProps) {
  const totalPot = bets.reduce((sum, b) => sum + b.amountLamports, 0) / LAMPORTS_PER_SOL;

  return (
    <div className="card live-bets-panel">
      <div className="live-bets-header">
        <h3 className="card-title">Live Bets</h3>
        <div className="live-bets-stats">
          <span>{bets.length} players</span>
          <span className="live-bets-pot">{formatSol(totalPot)} SOL</span>
        </div>
      </div>

      {bets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <p>No bets this round yet</p>
        </div>
      ) : (
        <div className="live-bets-list">
          {bets.map((bet) => (
            <div
              key={bet.id}
              className={`live-bet-row ${bet.cashedOut ? "cashed-out" : ""}`}
            >
              <div className="live-bet-player">
                <span className="live-bet-avatar">
                  {bet.walletAddress.slice(0, 1)}
                </span>
                <span className="mono-cell">{bet.walletAddress}</span>
              </div>
              <div className="live-bet-amount">
                {formatSol(bet.amountLamports / LAMPORTS_PER_SOL)} SOL
              </div>
              <div className="live-bet-status">
                {bet.cashedOut && bet.cashoutMultiplier ? (
                  <span className="text-success">
                    {bet.cashoutMultiplier.toFixed(2)}x
                  </span>
                ) : phase === "running" ? (
                  <span className="live-bet-playing">●</span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
