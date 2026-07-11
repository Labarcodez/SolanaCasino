import { motion } from "framer-motion";
import { ConnectTrigger } from "./ConnectTrigger";
import { PROGRAM_ID } from "../lib/api";
import { isMobileBrowser, isPortalConfigured } from "../lib/phantomProviders";
import { shortenAddress, solscanAccountUrl } from "../lib/utils";
import { BRAND, GAMES, TRUST_BADGES } from "../lib/brand";
import { CrashIcon, CoinflipIcon, LimboIcon, FairnessIcon } from "./icons/GameIcons";

interface LandingProps {
  socialLoginEnabled?: boolean;
  onChainEnabled?: boolean;
}

const FEATURE_ICONS = {
  crash: CrashIcon,
  limbo: LimboIcon,
  coinflip: CoinflipIcon,
  shield: FairnessIcon,
} as const;

const ACCENT_CLASS: Record<string, string> = {
  green: "feature-card--green",
  violet: "feature-card--violet",
  gold: "feature-card--gold",
  shield: "feature-card--shield",
};

const features = [
  ...GAMES.map((g) => ({
    icon: g.id as keyof typeof FEATURE_ICONS,
    title: g.name,
    desc: g.desc,
    accent: ACCENT_CLASS[g.accent] ?? "feature-card--violet",
    rtp: `${g.rtp} RTP`,
  })),
  {
    icon: "shield" as const,
    title: "Provably Fair",
    desc: "Every outcome verifiable on-chain. Cryptographic seeds — no trust required.",
    accent: "feature-card--shield",
    rtp: "Verifiable",
  },
];

const steps = [
  { n: "01", title: "Connect", desc: "Phantom, Google, or Apple" },
  { n: "02", title: "Deposit", desc: "SOL to vault PDA" },
  { n: "03", title: "Play", desc: "Crash, limbo & flip" },
  { n: "04", title: "Withdraw", desc: "Instant to wallet" },
];

export function Landing({ socialLoginEnabled, onChainEnabled }: LandingProps) {
  const taglineParts = BRAND.tagline.split(".");
  const mobile = isMobileBrowser();
  const portalReady = socialLoginEnabled ?? isPortalConfigured();

  return (
    <div className="landing">
      <motion.div
        className="landing-hero"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
      >
        <div className="landing-hero-badge">
          {onChainEnabled ? (
            <>
              <span className="on-chain-dot" />
              Anchor on-chain · Devnet
            </>
          ) : (
            <>⚡ Instant Solana gaming</>
          )}
        </div>

        <h1>
          {taglineParts[0]}.
          <br />
          <span>{taglineParts[1]?.trim() || "Win on Solana."}</span>
        </h1>
        <p>{BRAND.description}</p>

        <div className="landing-auth">
          <ConnectTrigger intent="play" label="Connect to play" size="lg" testId="landing-connect" />
          <div className="landing-auth-methods">
            {portalReady ? (
              <>
                <span className="auth-method-pill">Google</span>
                <span className="auth-method-pill">Apple</span>
                <span className="auth-method-pill">Phantom App</span>
                <span className="auth-method-pill">Extension</span>
              </>
            ) : mobile ? (
              <span className="auth-method-pill">Install Phantom app</span>
            ) : (
              <span className="auth-method-pill">Phantom Extension</span>
            )}
          </div>
        </div>

        {!portalReady && mobile && (
          <p className="landing-hint">
            On mobile, install the{" "}
            <a href="https://phantom.app/download" target="_blank" rel="noopener noreferrer">
              Phantom app
            </a>{" "}
            and use Google sign-in once the site operator enables Phantom Portal.
          </p>
        )}

        {!portalReady && !mobile && (
          <p className="landing-hint">
            Install the{" "}
            <a href="https://phantom.app/download" target="_blank" rel="noopener noreferrer">
              Phantom browser extension
            </a>{" "}
            for Chrome, Brave, or Edge.
          </p>
        )}

        <div className="landing-trust-strip">
          {TRUST_BADGES.map((b) => (
            <span key={b.label} className="trust-badge">
              <span className="trust-badge-dot" />
              {b.label}
            </span>
          ))}
        </div>
      </motion.div>

      <motion.div
        className="landing-steps"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {steps.map((s) => (
          <div key={s.n} className="landing-step">
            <span className="landing-step-n">{s.n}</span>
            <span className="landing-step-title">{s.title}</span>
            <span className="landing-step-desc">{s.desc}</span>
          </div>
        ))}
      </motion.div>

      <motion.div
        className="landing-features"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        {features.map((f) => {
          const Icon = FEATURE_ICONS[f.icon];
          return (
            <div key={f.title} className={`feature-card card-glow ${f.accent}`}>
              <div className="feature-icon-wrap">
                <Icon size={22} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <span className="feature-rtp">{f.rtp}</span>
            </div>
          );
        })}
      </motion.div>

      <motion.div
        className="landing-stats"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <div className="landing-stat">
          <div className="landing-stat-value">{BRAND.rtp}</div>
          <div className="landing-stat-label">Crash RTP</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-value">98%</div>
          <div className="landing-stat-label">Limbo RTP</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-value">&lt;1s</div>
          <div className="landing-stat-label">Settlement</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-value">{BRAND.minBet}</div>
          <div className="landing-stat-label">Min bet</div>
        </div>
      </motion.div>

      <p className="landing-wallet-link">
        Program:{" "}
        <a
          href={solscanAccountUrl(PROGRAM_ID.toBase58())}
          target="_blank"
          rel="noopener noreferrer"
        >
          {shortenAddress(PROGRAM_ID.toBase58(), 6)}
        </a>
      </p>
    </div>
  );
}
