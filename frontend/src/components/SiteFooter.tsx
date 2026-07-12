import { useEffect, useState } from "react";
import { BRAND, GAMES } from "../lib/brand";
import { CASINO_WALLET, fetchConfig } from "../lib/api";
import { solscanAccountUrl, shortenAddress } from "../lib/utils";

export function SiteFooter() {
  const [treasuryWallet, setTreasuryWallet] = useState(CASINO_WALLET);

  useEffect(() => {
    fetchConfig()
      .then((c) => setTreasuryWallet(c.casinoWallet))
      .catch(() => {
        // Keep build-time / fallback wallet
      });
  }, []);

  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="site-footer-brand">
          <p className="site-footer-name">{BRAND.name}</p>
          <p className="site-footer-tagline">{BRAND.tagline}</p>
        </div>

        <div className="site-footer-links">
          <a
            href={solscanAccountUrl(treasuryWallet)}
            target="_blank"
            rel="noopener noreferrer"
            title={treasuryWallet}
          >
            Treasury ({shortenAddress(treasuryWallet, 4)})
          </a>
          <a href={BRAND.docs} target="_blank" rel="noopener noreferrer">
            Docs
          </a>
          <a href={BRAND.discord} target="_blank" rel="noopener noreferrer">
            Discord
          </a>
          <span className="site-footer-divider">·</span>
          <span>
            {GAMES.map((g) => `${g.rtp} ${g.shortLabel}`).join(" · ")} RTP
          </span>
        </div>

        <div className="site-footer-social">
          <a href={BRAND.twitterUrl} target="_blank" rel="noopener noreferrer">
            {BRAND.twitter}
          </a>
          <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
          <a href={`https://${BRAND.domain}`} target="_blank" rel="noopener noreferrer">
            {BRAND.domain}
          </a>
        </div>

        <p className="site-footer-legal">
          Play responsibly. You must be of legal gambling age in your jurisdiction.
          Cryptocurrency gambling involves risk of loss. {BRAND.name} is a
          deposit-first provably fair casino on Solana.
        </p>
      </div>
    </footer>
  );
}