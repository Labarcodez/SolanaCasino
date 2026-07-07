import { BRAND } from "../lib/brand";
import { CASINO_WALLET } from "../lib/api";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="site-footer-brand">
          <p className="site-footer-name">{BRAND.name}</p>
          <p className="site-footer-tagline">{BRAND.tagline}</p>
        </div>

        <div className="site-footer-links">
          <a href={`https://solscan.io/account/${CASINO_WALLET}`} target="_blank" rel="noopener noreferrer">
            Treasury
          </a>
          <a href={BRAND.docs} target="_blank" rel="noopener noreferrer">
            Docs
          </a>
          <a href={BRAND.discord} target="_blank" rel="noopener noreferrer">
            Discord
          </a>
          <span className="site-footer-divider">·</span>
          <span>{BRAND.rtp} Crash RTP</span>
        </div>

        <p className="site-footer-legal">
          {BRAND.name} is a decentralized gaming platform on Solana. Play responsibly.
          You must be of legal gambling age in your jurisdiction. Cryptocurrency
          gambling involves risk of loss.
        </p>
      </div>
    </footer>
  );
}
