import { ConnectButton } from "@phantom/react-sdk";
import { CASINO_WALLET } from "../lib/api";

interface LandingProps {
  socialLoginEnabled?: boolean;
}

export function Landing({ socialLoginEnabled }: LandingProps) {
  return (
    <div className="landing">
      <h1>
        Gamble <span>Real SOL</span>
        <br />
        On Solana
      </h1>
      <p>
        Provably fair crash and coinflip games. Sign in with your Phantom wallet
        or Google/Apple email. Deposit real SOL, play, and withdraw your
        winnings instantly.
      </p>

      <ConnectButton />

      {!socialLoginEnabled && (
        <p style={{ marginTop: 16, fontSize: "0.85rem", color: "var(--warning)" }}>
          Email login (Google/Apple) requires a Phantom Portal app ID. Phantom
          wallet extension works without it.
        </p>
      )}

      <div className="landing-features">
        <div className="feature-card">
          <h3>🚀 Crash Game</h3>
          <p>
            Watch the multiplier climb. Cash out before the crash to lock in
            your winnings. Provably fair with 95% RTP.
          </p>
        </div>
        <div className="feature-card">
          <h3>🪙 Coinflip</h3>
          <p>
            Classic 50/50 coinflip with instant results. Pick heads or tails and
            double your SOL.
          </p>
        </div>
        <div className="feature-card">
          <h3>🔐 Provably Fair</h3>
          <p>
            Every round uses cryptographic seeds you can verify. Transparent
            outcomes, no hidden tricks.
          </p>
        </div>
      </div>

      <p style={{ marginTop: 48, fontSize: "0.8rem", color: "var(--text-muted)" }}>
        Casino wallet:{" "}
        <a
          href={`https://solscan.io/account/${CASINO_WALLET}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {CASINO_WALLET.slice(0, 8)}...{CASINO_WALLET.slice(-8)}
        </a>
      </p>
    </div>
  );
}
