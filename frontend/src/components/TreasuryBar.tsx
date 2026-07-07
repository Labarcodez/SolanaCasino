import { useCallback, useEffect, useState } from "react";
import { fetchCasinoStats, type CasinoStats } from "../lib/api";
import { BRAND } from "../lib/brand";

export function TreasuryBar() {
  const [stats, setStats] = useState<CasinoStats | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    fetchCasinoStats()
      .then((data) => {
        setStats(data);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  if (error && !stats) return null;

  return (
    <div className="treasury-bar">
      <div className="container treasury-bar-inner">
        {stats ? (
          <>
            <span className="treasury-stat">
              <strong>{stats.handle24hSol.toFixed(2)}</strong> SOL 24h volume
            </span>
            <span className="treasury-divider">·</span>
            <span className="treasury-stat">
              <strong>{stats.tournamentPrizePoolSol.toFixed(3)}</strong> SOL tournament pool
            </span>
            <span className="treasury-divider">·</span>
            <span className="treasury-stat">
              <strong>{stats.totalUsers}</strong> players
            </span>
            <span className="treasury-divider">·</span>
            <span className="treasury-stat treasury-brand">{BRAND.name} · Provably fair</span>
          </>
        ) : (
          <span className="treasury-stat">Loading live stats...</span>
        )}
      </div>
    </div>
  );
}
