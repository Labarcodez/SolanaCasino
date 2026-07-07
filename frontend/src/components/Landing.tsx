import { motion } from "framer-motion";
import { ConnectButton } from "@phantom/react-sdk";
import { PROGRAM_ID } from "../lib/api";
import { shortenAddress } from "../lib/utils";

interface LandingProps {
  socialLoginEnabled?: boolean;
  onChainEnabled?: boolean;
}

const features = [
  {
    icon: "🚀",
    title: "Crash",
    desc: "Ride the multiplier. Cash out before the rocket crashes. 95% RTP, provably fair on-chain.",
  },
  {
    icon: "🪙",
    title: "Coinflip",
    desc: "Instant 50/50 flips with commit-reveal seeds. Double your SOL in one click.",
  },
  {
    icon: "🔐",
    title: "Provably Fair",
    desc: "Every outcome verifiable via cryptographic seeds. No hidden logic, no trust required.",
  },
];

export function Landing({ socialLoginEnabled, onChainEnabled }: LandingProps) {
  return (
    <div className="landing">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="landing-hero-badge">
          {onChainEnabled ? (
            <>
              <span className="on-chain-dot" />
              Powered by Solana + Anchor
            </>
          ) : (
            <>⚡ Instant play on Solana</>
          )}
        </div>

        <h1>
          Gamble <span>Real SOL</span>
          <br />
          On Solana
        </h1>
        <p>
          Connect with Phantom, Google, or Apple. Deposit to the vault, play
          crash and coinflip, and withdraw winnings instantly.
        </p>

        <div className="landing-auth">
          <ConnectButton />
          <div className="landing-auth-methods">
            {socialLoginEnabled ? (
              <>
                <span className="auth-method-pill">Google</span>
                <span className="auth-method-pill">Apple</span>
                <span className="auth-method-pill">Phantom Wallet</span>
              </>
            ) : (
              <span className="auth-method-pill">Phantom Extension</span>
            )}
          </div>
        </div>

        {!socialLoginEnabled && (
          <p className="landing-hint">
            Email login (Google / Apple) needs a Phantom Portal app ID. Set{" "}
            <code>VITE_PHANTOM_APP_ID</code> to enable embedded wallets.
          </p>
        )}

        {socialLoginEnabled && (
          <p className="landing-hint success">
            Sign in with Google or Apple for a passwordless embedded wallet, or
            connect your existing Phantom extension.
          </p>
        )}
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
        transition={{ delay: 0.3 }}
      >
        <div className="landing-stat">
          <div className="landing-stat-value">95%</div>
          <div className="landing-stat-label">Crash RTP</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-value">&lt;1s</div>
          <div className="landing-stat-label">Settlement</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-value">0.001</div>
          <div className="landing-stat-label">Min bet SOL</div>
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
