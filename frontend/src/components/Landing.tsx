import { motion } from "framer-motion";
import { ConnectButton } from "@phantom/react-sdk";
import { PROGRAM_ID } from "../lib/api";
import { shortenAddress } from "../lib/utils";
import { BRAND } from "../lib/brand";

interface LandingProps {
  socialLoginEnabled?: boolean;
  onChainEnabled?: boolean;
}

const features = [
  {
    icon: "🚀",
    title: "Crash",
    desc: "Ride the multiplier curve. Cash out before the bust. 95% RTP with on-chain settlement.",
    color: "var(--solana-green)",
  },
  {
    icon: "🎯",
    title: "Limbo",
    desc: "Set your target multiplier and roll. 98% RTP grinder game with instant results.",
    color: "var(--accent-bright)",
  },
  {
    icon: "🪙",
    title: "Coinflip",
    desc: "Instant 50/50 flips with commit-reveal seeds. Double your SOL in one click.",
    color: "var(--warning)",
  },
  {
    icon: "🔐",
    title: "Provably Fair",
    desc: "Every outcome verifiable on-chain. Cryptographic seeds — no trust required.",
    color: "var(--solana-green)",
  },
];

const steps = [
  { n: "01", title: "Connect", desc: "Phantom, Google, or Apple" },
  { n: "02", title: "Deposit", desc: "SOL to vault PDA" },
  { n: "03", title: "Play", desc: "Crash, limbo & flip" },
  { n: "04", title: "Withdraw", desc: "Instant to wallet" },
];

export function Landing({ socialLoginEnabled, onChainEnabled }: LandingProps) {
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
          {BRAND.tagline.split(".")[0]}.
          <br />
          <span>{BRAND.tagline.split(".")[1]?.trim() || "Win on Solana."}</span>
        </h1>
        <p>{BRAND.description}</p>

        <div className="landing-auth">
          <ConnectButton />
          <div className="landing-auth-methods">
            {socialLoginEnabled ? (
              <>
                <span className="auth-method-pill">Google</span>
                <span className="auth-method-pill">Apple</span>
                <span className="auth-method-pill">Phantom</span>
              </>
            ) : (
              <span className="auth-method-pill">Phantom Extension</span>
            )}
          </div>
        </div>

        {!socialLoginEnabled && (
          <p className="landing-hint">
            Set <code>VITE_PHANTOM_APP_ID</code> for Google & Apple login
          </p>
        )}
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
        {features.map((f) => (
          <div key={f.title} className="feature-card card-glow">
            <div className="feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
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
          href={`https://solscan.io/account/${PROGRAM_ID.toBase58()}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {shortenAddress(PROGRAM_ID.toBase58(), 6)}
        </a>
      </p>
    </div>
  );
}
