import { useEffect, useState } from "react";
import { fetchJackpot, formatSol } from "../lib/api";
import type { JackpotState } from "../hooks/useSocket";

interface CrashJackpotBannerProps {
  jackpot: JackpotState | null;
}

export function CrashJackpotBanner({ jackpot }: CrashJackpotBannerProps) {
  const [state, setState] = useState<JackpotState | null>(jackpot);

  useEffect(() => {
    if (jackpot) {
      setState(jackpot);
      return;
    }
    void fetchJackpot()
      .then(setState)
      .catch(() => undefined);
  }, [jackpot]);

  if (!state) return null;

  const poolSol = state.poolSol;
  const minCrash = state.minCrashMultiplier;

  return (
    <div className="crash-jackpot-banner" data-testid="crash-jackpot-banner">
      <div className="crash-jackpot-banner__main">
        <span className="crash-jackpot-banner__label">Crash Jackpot</span>
        <span className="crash-jackpot-banner__pool">
          {formatSol(poolSol, 3)} SOL
        </span>
      </div>
      <p className="crash-jackpot-banner__hint panel-hint">
        {(state.contributionBps / 100).toFixed(1)}% of crash bets feed the pool.
        When the round crashes at {minCrash.toFixed(1)}x or higher, the highest
        cashout wins the pool.
      </p>
      {state.lastPayout && (
        <p className="crash-jackpot-banner__last panel-hint">
          Last win: {state.lastPayout.walletAddress} took{" "}
          {formatSol(state.lastPayout.amountSol, 3)} SOL @{" "}
          {state.lastPayout.cashoutMultiplier.toFixed(2)}x (crashed{" "}
          {state.lastPayout.crashPoint.toFixed(2)}x)
        </p>
      )}
    </div>
  );
}
