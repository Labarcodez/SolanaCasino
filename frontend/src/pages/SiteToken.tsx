import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { fetchOrbitToken, type OrbitTokenInfo } from "../lib/api";
import { getPumpFunUrl } from "../lib/pump";
import { BRAND } from "../lib/brand";

interface SiteTokenPageProps {
  onLaunchClick?: () => void;
}

export function SiteTokenPage({ onLaunchClick }: SiteTokenPageProps) {
  const [info, setInfo] = useState<OrbitTokenInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrbitToken()
      .then(setInfo)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      );
  }, []);

  const mint = info?.mint;

  return (
    <div className="card card-glow site-token-page">
      <PageHeader
        title={`${BRAND.name} Token`}
        subtitle="Pump.fun bonding curve · community memecoin"
      />

      {error && <p className="panel-hint text-danger">{error}</p>}

      {!mint ? (
        <div className="site-token-empty">
          <p className="panel-hint">
            No site token registered yet. Launch the official {BRAND.name}{" "}
            memecoin on Pump.fun — metadata is stored on Orbit, you sign with
            Phantom.
          </p>
          <div className="site-token-curve-info">
            <h3>How the bonding curve works</h3>
            <p className="panel-hint">
              Early buyers get a lower price; as more SOL enters the curve, the
              price rises. When the curve completes, liquidity moves to Raydium
              and the token trades on the open market.
            </p>
          </div>
          {onLaunchClick && (
            <button type="button" className="btn btn-primary" onClick={onLaunchClick}>
              Launch token
            </button>
          )}
        </div>
      ) : (
        <div className="site-token-detail">
          <div className="site-token-stat">
            <span className="label">Mint address</span>
            <code className="site-token-mint">{mint}</code>
          </div>
          <div className="site-token-stat">
            <span className="label">Network</span>
            <span>{info?.cluster ?? "mainnet-beta"}</span>
          </div>

          <div className="site-token-curve-card">
            <h3>Bonding curve</h3>
            <p className="panel-hint">
              Live curve progress, market cap, and buy/sell are on Pump.fun.
              Orbit links you there — always verify the mint address above
              before trading.
            </p>
            <div className="site-token-curve-bar" aria-hidden="true">
              <div className="site-token-curve-bar-fill" />
            </div>
            <p className="site-token-curve-note">
              Open Pump.fun for real-time curve status and to buy with Phantom.
            </p>
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
        </div>
      )}
    </div>
  );
}
