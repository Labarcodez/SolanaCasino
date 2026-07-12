import { useCallback, useEffect, useState } from "react";
import { fetchRecentWins, fetchConfig, type RecentWin } from "../lib/api";
import { shortenAddress } from "../lib/utils";

const GAME_LABELS: Record<string, string> = {
  crash: "Crash",
  coinflip: "Coinflip",
  limbo: "Limbo",
};

function formatWinMessage(win: RecentWin): string {
  const name = win.displayName || shortenAddress(win.walletAddress, 4);
  const game = GAME_LABELS[win.game] ?? win.game;
  if (win.multiplier && win.multiplier > 1) {
    return `${name} won ${win.payoutSol.toFixed(4)} SOL on ${game} (${win.multiplier.toFixed(2)}x)`;
  }
  return `${name} won ${win.payoutSol.toFixed(4)} SOL on ${game}`;
}

export function LiveActivityMarquee() {
  const [wins, setWins] = useState<RecentWin[]>([]);
  const [cluster, setCluster] = useState<string | undefined>();

  const load = useCallback(() => {
    fetchRecentWins()
      .then(setWins)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchConfig()
      .then((c) => setCluster(c.cluster))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const isMainnet = cluster === "mainnet-beta";
  const payoutHint = isMainnet
    ? "Deposit-first vault · fast SOL withdrawals"
    : "Deposit-first vault · devnet testing";

  const messages =
    wins.length > 0
      ? wins.map(formatWinMessage)
      : [
          "Orbit Solana Casino — provably fair Solana gaming",
          "Crash · Limbo · Coinflip — play with Phantom",
          payoutHint,
        ];

  const doubled = [...messages, ...messages];

  return (
    <div className="live-marquee" aria-hidden="true">
      <div className="live-marquee-label">
        <span className="live-dot" />
        Live
      </div>
      <div className="live-marquee-track-wrap">
        <div className="live-marquee-track">
          {doubled.map((msg, i) => (
            <span key={`${msg}-${i}`} className="live-marquee-item">
              {msg}
              <span className="live-marquee-sep">◆</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
