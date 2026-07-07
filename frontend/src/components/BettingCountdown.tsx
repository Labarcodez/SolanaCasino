import { useEffect, useState } from "react";

const BETTING_DURATION_MS = 8000;

interface BettingCountdownProps {
  phase: string;
  bettingEndsAt?: number;
  startedAt?: number;
}

export function BettingCountdown({
  phase,
  bettingEndsAt,
  startedAt,
}: BettingCountdownProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (phase !== "betting") {
      setRemaining(0);
      return;
    }

    const endsAt =
      bettingEndsAt ?? (startedAt ? startedAt + BETTING_DURATION_MS : 0);
    if (!endsAt) return;

    const tick = () => {
      const left = Math.max(0, endsAt - Date.now());
      setRemaining(left);
    };

    tick();
    const interval = setInterval(tick, 50);
    return () => clearInterval(interval);
  }, [phase, bettingEndsAt, startedAt]);

  if (phase !== "betting" || remaining <= 0) return null;

  const progress = 1 - remaining / BETTING_DURATION_MS;
  const seconds = (remaining / 1000).toFixed(1);

  return (
    <div className="betting-countdown">
      <div className="betting-countdown-bar">
        <div
          className="betting-countdown-fill"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="betting-countdown-label">
        Starting in <strong>{seconds}s</strong>
      </span>
    </div>
  );
}
