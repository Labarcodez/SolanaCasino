import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import {
  fetchCasinoStats,
  fetchOrbitToken,
  formatSol,
  shortenAddress,
  type OrbitTokenInfo,
} from "../lib/api";
import { getPumpFunUrl } from "../lib/pumpUrl";
import type { PumpBondingCurveStats, PumpTokenMetadata } from "../lib/pumpTypes";
import { getBagsFmTokenUrl } from "../lib/bags";
import { BRAND } from "../lib/brand";
import { ORBIT_TOKEN_COPY, orbitTokenDescriptionParagraphs } from "../lib/orbitTokenCopy";
import { solscanAccountUrl } from "../lib/utils";

const PUMP_FUN_HOME = "https://pump.fun";

const TOKEN_UTILITY = [
  "Casino treasury growth",
  "Creator-fee holder lottery",
  "Future VIP rewards",
  "Community incentives",
] as const;

const FUNDING_USES = [
  {
    title: "Platform development",
    detail: "Crash, limbo, coinflip polish, mobile UX, and provably-fair tooling.",
  },
  {
    title: "Bonding curve growth",
    detail:
      "Pump.fun curve fills toward graduation — liquidity and visibility build as the community trades ORBIT.",
  },
  {
    title: "Infrastructure",
    detail: "RPC, hosting, monitoring, and security for 24/7 uptime on mainnet.",
  },
  {
    title: "Future expansion",
    detail: "New games, tournaments, jackpots, and ecosystem partnerships.",
  },
] as const;

const ROADMAP = [
  { phase: "Now", label: "Live casino", status: "done" },
  { phase: "Launch", label: "Orbit Token on Pump.fun", status: "next" },
  { phase: "Post-launch", label: "Creator-fee holder lottery (every 5 min)", status: "planned" },
  { phase: "Future", label: "VIP utility & community incentives", status: "planned" },
] as const;

function HolderLotteryCard({
  lottery,
}: {
  lottery: NonNullable<OrbitTokenInfo["rewardLottery"]>;
}) {
  const mins = Math.round(lottery.intervalMs / 60_000);
  return (
    <section className="site-token-section site-token-lottery" data-testid="token-holder-lottery">
      <h3>Holder lottery</h3>
      <p className="panel-hint">
        Every {mins} minutes we claim Pump.fun creator rewards.{" "}
        <strong>{lottery.winnerPercent}%</strong> of that claimed amount goes to a random
        holder (weighted by balance). The rest stays as newly claimed treasury — never from
        deposit float.
      </p>
      {lottery.recent.length > 0 ? (
        <ul className="site-token-lottery-list">
          {lottery.recent.map((row) => (
            <li key={row.id}>
              <code>
                {row.winnerWallet
                  ? shortenAddress(row.winnerWallet)
                  : "Claim only (no payout)"}
              </code>
              <span>
                {formatSol(row.winnerSol, 4)} SOL / {formatSol(row.claimedSol, 4)} claimed
                {row.payoutSignature ? (
                  <>
                    {" "}
                    ·{" "}
                    <a
                      href={`https://solscan.io/tx/${row.payoutSignature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      tx
                    </a>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel-hint">No draws yet — activates when claimable creator fees accrue.</p>
      )}
    </section>
  );
}

function TreasuryWalletCard({ address }: { address: string }) {
  return (
    <div className="site-token-treasury-card">
      <span className="label">Treasury wallet</span>
      <code className="site-token-mint">{address}</code>
      <div className="site-token-actions site-token-actions--inline">
        <a
          href={solscanAccountUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-sm"
        >
          View on Solscan
        </a>
      </div>
    </div>
  );
}

function NotifyMeButtons() {
  return (
    <div className="site-token-notify" data-testid="token-notify-me">
      <p className="panel-hint">Get launch announcements and early supporter updates:</p>
      <div className="site-token-actions">
        <a
          href={BRAND.discord}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          Notify me — Discord
        </a>
        <a
          href={BRAND.twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline"
        >
          Follow on X
        </a>
      </div>
    </div>
  );
}

function ComingSoonPump({ info }: { info: OrbitTokenInfo }) {
  return (
    <div className="site-token-coming-soon" data-testid="token-coming-soon">
      <div className="site-token-hero-announce">
        <span className="site-token-status-badge">Launching soon</span>
        <h3>🪐 {BRAND.shortName} Token — launching on Pump.fun</h3>
        <p className="panel-hint">
          The {BRAND.shortName} Token will launch on{" "}
          <a href={PUMP_FUN_HOME} target="_blank" rel="noopener noreferrer">
            Pump.fun
          </a>{" "}
          from treasury wallet{" "}
          <code className="site-token-mint">{info.treasuryWallet}</code> with a{" "}
          <strong>${ORBIT_TOKEN_COPY.initialBuyUsd}</strong> initial buy. Creator
          rewards and curve volume fund the casino treasury. No buy button until
          the token is live.
        </p>
      </div>

      <section className="site-token-section site-token-about">
        <h3>About ORBIT</h3>
        <div className="site-token-description">
          {orbitTokenDescriptionParagraphs().map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="panel-hint">
              {paragraph}
            </p>
          ))}
        </div>
        <div className="site-token-actions site-token-actions--inline">
          <a
            href={ORBIT_TOKEN_COPY.website}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
            data-testid="token-website-link"
          >
            orbit-casino.com
          </a>
          <a
            href={ORBIT_TOKEN_COPY.twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
            data-testid="token-x-link"
          >
            {BRAND.twitter} on X
          </a>
        </div>
      </section>

      <div className="site-token-grid">
        <section className="site-token-section">
          <h3>Token overview</h3>
          <dl className="site-token-dl">
            <div>
              <dt>Status</dt>
              <dd>Coming soon</dd>
            </div>
            <div>
              <dt>Launch platform</dt>
              <dd>
                <a href={PUMP_FUN_HOME} target="_blank" rel="noopener noreferrer">
                  Pump.fun
                </a>
              </dd>
            </div>
            <div>
              <dt>Launch date</dt>
              <dd>{info.launchDateLabel}</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>{info.cluster}</dd>
            </div>
            <div>
              <dt>Website</dt>
              <dd>
                <a
                  href={ORBIT_TOKEN_COPY.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  orbit-casino.com
                </a>
              </dd>
            </div>
            <div>
              <dt>X (Twitter)</dt>
              <dd>
                <a
                  href={ORBIT_TOKEN_COPY.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {BRAND.twitter}
                </a>
              </dd>
            </div>
          </dl>
        </section>

        <section className="site-token-section">
          <h3>Utility</h3>
          <ul className="site-token-list">
            {TOKEN_UTILITY.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <TreasuryWalletCard address={info.treasuryWallet} />

      <section className="site-token-section">
        <h3>What funding supports</h3>
        <div className="site-token-funding-grid">
          {FUNDING_USES.map((item) => (
            <article key={item.title} className="site-token-funding-card">
              <h4>{item.title}</h4>
              <p className="panel-hint">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="site-token-section">
        <h3>Roadmap</h3>
        <ol className="site-token-roadmap">
          {ROADMAP.map((step) => (
            <li key={step.phase} className={`site-token-roadmap-item site-token-roadmap-item--${step.status}`}>
              <span className="site-token-roadmap-phase">{step.phase}</span>
              <span className="site-token-roadmap-label">{step.label}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="site-token-launch-platform">
        <h3>Launch platform</h3>
        <p className="panel-hint">
          We are preparing our Pump.fun launch to fund the treasury transparently.
          Follow{" "}
          <a href={ORBIT_TOKEN_COPY.website} target="_blank" rel="noopener noreferrer">
            orbit-casino.com
          </a>{" "}
          and{" "}
          <a href={ORBIT_TOKEN_COPY.twitter} target="_blank" rel="noopener noreferrer">
            {BRAND.twitter}
          </a>{" "}
          for the drop — no buy button until the token is live.
        </p>
        <a
          href={PUMP_FUN_HOME}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline"
          data-testid="token-pump-fm-link"
        >
          Launch on Pump.fun
        </a>
      </div>

      <NotifyMeButtons />
    </div>
  );
}

function LiveBagsToken({
  info,
  mint,
  treasuryBalanceSol,
}: {
  info: OrbitTokenInfo;
  mint: string;
  treasuryBalanceSol: number | null;
}) {
  const bagsUrl = info.bagsFmUrl ?? getBagsFmTokenUrl(mint);

  return (
    <div className="site-token-live" data-testid="token-live">
      <div className="site-token-hero-announce">
        <span className="site-token-status-badge site-token-status-badge--live">Live</span>
        <h3>{BRAND.shortName} Token</h3>
      </div>

      <dl className="site-token-dl site-token-dl--live">
        <div>
          <dt>Contract address</dt>
          <dd>
            <code className="site-token-mint">{mint}</code>
          </dd>
        </div>
        <div>
          <dt>Treasury wallet</dt>
          <dd>
            <code className="site-token-mint">{info.treasuryWallet}</code>
          </dd>
        </div>
        {treasuryBalanceSol !== null && (
          <div>
            <dt>Treasury balance</dt>
            <dd>{formatSol(treasuryBalanceSol, 4)} SOL</dd>
          </div>
        )}
        {info.bagsLiveStats?.lifetimeFeesSol !== null &&
          info.bagsLiveStats?.lifetimeFeesSol !== undefined && (
            <div>
              <dt>Lifetime fees (Bags)</dt>
              <dd>{formatSol(info.bagsLiveStats.lifetimeFeesSol, 4)} SOL</dd>
            </div>
          )}
        {info.bagsLiveStats?.pool && (
          <div>
            <dt>Pool status</dt>
            <dd>{info.bagsLiveStats.pool.migrated ? "Migrated to DAMM v2" : "Bonding curve"}</dd>
          </div>
        )}
      </dl>

      <div className="site-token-actions">
        <a
          href={bagsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          data-testid="token-view-bags"
        >
          View on Bags.fm
        </a>
        <a
          href={bagsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline"
          data-testid="token-buy-bags"
        >
          Buy token
        </a>
        <a
          href={`https://solscan.io/token/${mint}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline"
        >
          View chart (Solscan)
        </a>
      </div>
    </div>
  );
}

function LivePumpToken({
  info,
  mint,
  stats,
  metadata,
  statsLoading,
  treasuryBalanceSol,
}: {
  info: OrbitTokenInfo;
  mint: string;
  stats: PumpBondingCurveStats | null;
  metadata: PumpTokenMetadata | null;
  statsLoading: boolean;
  treasuryBalanceSol: number | null;
}) {
  const progress = stats?.progressPercent ?? 0;

  return (
    <div className="site-token-detail" data-testid="token-live-pump">
      {metadata?.image && (
        <img
          src={metadata.image}
          alt={metadata.name ?? "Token"}
          className="site-token-image"
        />
      )}
      {metadata?.name && (
        <div className="site-token-stat">
          <span className="label">Name</span>
          <span>
            {metadata.name}
            {metadata.symbol ? ` ($${metadata.symbol})` : ""}
          </span>
        </div>
      )}
      <div className="site-token-stat">
        <span className="label">Mint address</span>
        <code className="site-token-mint">{mint}</code>
      </div>
      {treasuryBalanceSol !== null && (
        <div className="site-token-stat">
          <span className="label">Treasury balance</span>
          <span>{formatSol(treasuryBalanceSol, 4)} SOL</span>
        </div>
      )}

      <div className="site-token-curve-card">
        <h3>Bonding curve</h3>
        {statsLoading && !stats ? (
          <p className="panel-hint">Loading live curve data…</p>
        ) : stats?.exists ? (
          <>
            <div className="site-token-curve-stats">
              <div>
                <span className="label">Progress</span>
                <strong>{progress.toFixed(1)}%</strong>
              </div>
              <div>
                <span className="label">Market cap</span>
                <strong>{formatSol(stats.marketCapSol, 2)} SOL</strong>
              </div>
            </div>
            <div
              className="site-token-curve-bar"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="site-token-curve-bar-fill"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </>
        ) : (
          <p className="panel-hint">Could not load on-chain curve data.</p>
        )}
      </div>

      <div className="site-token-actions">
        <a
          href={getPumpFunUrl(mint)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          Buy on Pump.fun
        </a>
        <a
          href={`https://solscan.io/token/${mint}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline"
        >
          View on Solscan
        </a>
      </div>
      {info.rewardLottery && <HolderLotteryCard lottery={info.rewardLottery} />}
      <TreasuryWalletCard address={info.treasuryWallet} />
    </div>
  );
}

export function SiteTokenPage() {
  const [info, setInfo] = useState<OrbitTokenInfo | null>(null);
  const [stats, setStats] = useState<PumpBondingCurveStats | null>(null);
  const [metadata, setMetadata] = useState<PumpTokenMetadata | null>(null);
  const [treasuryBalanceSol, setTreasuryBalanceSol] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrbitToken()
      .then(setInfo)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      );
    fetchCasinoStats()
      .then((s) => setTreasuryBalanceSol(s.casinoBalanceSol))
      .catch(() => setTreasuryBalanceSol(null));
  }, []);

  const mint = info?.mint;
  const isLive = info?.launchStatus === "live" && Boolean(mint);
  const isBags = info?.launchPlatform === "bags";

  useEffect(() => {
    if (!mint || !isLive || isBags) {
      setStats(null);
      setMetadata(null);
      return;
    }

    let cancelled = false;
    setStatsLoading(true);

    void import("../lib/pump")
      .then((pump) =>
        Promise.all([
          pump.fetchPumpBondingCurveStats(mint),
          pump.fetchPumpTokenMetadata(mint),
        ]),
      )
      .then(([curveStats, meta]) => {
        if (cancelled) return;
        setStats(curveStats);
        setMetadata(meta);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mint, isLive, isBags]);

  const subtitle =
    info?.launchStatus === "live"
      ? isBags
        ? "Live on Bags.fm · treasury-backed ecosystem"
        : "Pump.fun bonding curve · community memecoin"
      : "Launching soon on Pump.fun · fund the Orbit treasury";

  return (
    <div className="card card-glow site-token-page">
      <PageHeader title={`${BRAND.shortName} Token`} subtitle={subtitle} />

      {error && <p className="panel-hint text-danger">{error}</p>}

      {!info ? (
        <p className="panel-hint">Loading token info…</p>
      ) : isLive && mint && isBags ? (
        <LiveBagsToken
          info={info}
          mint={mint}
          treasuryBalanceSol={treasuryBalanceSol}
        />
      ) : isLive && mint ? (
        <LivePumpToken
          info={info}
          mint={mint}
          stats={stats}
          metadata={metadata}
          statsLoading={statsLoading}
          treasuryBalanceSol={treasuryBalanceSol}
        />
      ) : (
        <ComingSoonPump info={info} />
      )}

      {info && (
        <p className="site-token-footer-hint panel-hint">
          Treasury ({shortenAddress(info.treasuryWallet)}) holds player
          deposits and withdrawal liquidity. Follow{" "}
          <a href={BRAND.twitterUrl} target="_blank" rel="noopener noreferrer">
            {BRAND.twitter}
          </a>{" "}
          and{" "}
          <a href={BRAND.discord} target="_blank" rel="noopener noreferrer">
            Discord
          </a>{" "}
          for the Pump.fun launch.
        </p>
      )}
    </div>
  );
}
