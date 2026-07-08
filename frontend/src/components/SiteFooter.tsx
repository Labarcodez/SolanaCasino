import { useEffect, useState } from "react";
import { BRAND } from "../lib/brand";
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