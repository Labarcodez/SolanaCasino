import { useEffect } from "react";
import { BRAND } from "../lib/brand";
import { tabToPath, type GameTab } from "./useGameTab";

const BASE_TITLE = BRAND.name;
const BASE_URL = `https://${BRAND.domain}`;
const OG_IMAGE = `${BASE_URL}/og-image.png`;

const PAGE_SEO: Partial<
  Record<GameTab, { title: string; description: string }>
> = {
  crash: {
    title: "Crash",
    description:
      "Ride the multiplier curve on Orbit Crash. Dual bet panels, auto-cashout, and provably fair rounds on Solana.",
  },
  limbo: {
    title: "Limbo",
    description:
      "Set your target multiplier and roll instant Limbo rounds with 95% RTP on Orbit Solana Casino.",
  },
  coinflip: {
    title: "Coinflip",
    description:
      "Fast 50/50 coinflip with commit-reveal fairness. Bet SOL and flip on Orbit Solana Casino.",
  },
  leaderboard: {
    title: "Leaderboard",
    description:
      "See top Orbit players by total wagered. Climb the ranks across crash, limbo, and coinflip.",
  },
  tournament: {
    title: "Tournament",
    description:
      "Weekly Orbit tournament — top wagerers split the SOL prize pool. Prizes paid automatically.",
  },
  fairness: {
    title: "Provably Fair",
    description:
      "Verify crash, limbo, and coinflip outcomes with server seed hashes and round IDs on Orbit.",
  },
  wallet: {
    title: "Wallet",
    description:
      "Deposit and withdraw SOL on Orbit. Fast custodial balance with on-chain vault backing.",
  },
  profile: {
    title: "Profile",
    description:
      "Manage your Orbit profile, VIP rakeback, affiliate referrals, and display name.",
  },
  token: {
    title: "ORBIT Token",
    description:
      "Track the ORBIT token bonding curve, market cap, and Pump.fun launch stats on Orbit Casino.",
  },
  admin: {
    title: "Admin",
    description: "Orbit Solana Casino admin dashboard.",
  },
  launch: {
    title: "Launch Token",
    description: "Orbit Solana Casino token launch tools.",
  },
};

function upsertMeta(
  attr: "name" | "property",
  key: string,
  content: string,
): void {
  let el = document.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string): void {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useDocumentTitle(activeTab: GameTab): void {
  useEffect(() => {
    const seo = PAGE_SEO[activeTab];
    const pageTitle = seo?.title;
    const fullTitle = pageTitle ? `${pageTitle} — ${BASE_TITLE}` : BASE_TITLE;
    const description = seo?.description ?? BRAND.description;
    const canonical = `${BASE_URL}${tabToPath(activeTab)}`;

    document.title = fullTitle;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", OG_IMAGE);
    upsertMeta("property", "og:image:width", "1200");
    upsertMeta("property", "og:image:height", "630");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", OG_IMAGE);
    upsertCanonical(canonical);

    return () => {
      document.title = BASE_TITLE;
    };
  }, [activeTab]);
}
