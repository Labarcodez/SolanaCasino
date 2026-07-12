import { useEffect, useMemo, useRef, useState } from "react";
import type { CrashPhase } from "../hooks/useSocket";
import { fetchCrashStats } from "../lib/api";
import { formatCrashElapsed } from "../lib/crashTime";
import { crashPointVariant } from "./RecentResultsStrip";

interface CrashRoundStatsProps {
  phase: CrashPhase;
  multiplier: number;
  crashPoint?: number;
  elapsedMs?: number;
}

export function CrashRoundStats({
  phase,
  multiplier,
  crashPoint,
  elapsedMs = 0,
}: CrashRoundStatsProps) {
  const [hourlyHighDb, setHourlyHighDb] = useState(1);
  const [displayElapsed, setDisplayElapsed] = useState(0);
  const syncRef = useRef({ base: 0, at: 0 });

  const loadStats = () => {
    fetchCrashStats()
      .then((s) => setHourlyHighDb(s.hourlyHigh))
      .catch(() => {
        /* optional — keep last value */
      });
  };

  useEffect(() => {
    loadStats();
    const id = setInterval(loadStats, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase === "crashed") loadStats();
  }, [phase]);

  useEffect(() => {
    if (phase !== "running") {
      setDisplayElapsed(0);
      return;
    }

    syncRef.current = { base: elapsedMs, at: performance.now() };
    setDisplayElapsed(elapsedMs);

    const id = window.setInterval(() => {
      const { base, at } = syncRef.current;
      const drift = Math.min(120, Math.max(0, performance.now() - at));
      setDisplayElapsed(base + drift);
    }, 200);

    return () => clearInterval(id);
  }, [phase, elapsedMs]);

  const currentPeak =
    phase === "running"
      ? multiplier
      : phase === "crashed"
        ? (crashPoint ?? multiplier)
        : 1;

  const hourlyHigh = useMemo(
    () => Math.max(hourlyHighDb, currentPeak),
    [hourlyHighDb, currentPeak],
  );

  const highVariant = crashPointVariant(hourlyHigh);

  return (
    <div className="crash-round-stats" data-testid="crash-round-stats">
      <div className={`crash-stat-chip crash-stat-chip--${highVariant}`}>
        <span className="crash-stat-label">1h high</span>
        <span className="crash-stat-value">{hourlyHigh.toFixed(2)}x</span>
      </div>
      {phase === "running" && (
        <div className="crash-stat-chip crash-stat-chip--live">
          <span className="crash-stat-label">Round time</span>
          <span className="crash-stat-value crash-stat-value--elapsed">
            {formatCrashElapsed(displayElapsed)}
          </span>
        </div>
      )}
      {phase === "crashed" && crashPoint !== undefined && (
        <div className="crash-stat-chip crash-stat-chip--crashed">
          <span className="crash-stat-label">Last round</span>
          <span className="crash-stat-value">{crashPoint.toFixed(2)}x</span>
        </div>
      )}
    </div>
  );
}
