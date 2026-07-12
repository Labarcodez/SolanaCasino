import { Logo } from "./Logo";
import { BRAND } from "../lib/brand";

interface AuthSignInOverlayProps {
  authProvider?: string;
  authLoading: boolean;
  authError: string | null;
  onSignIn: () => void;
  onSignOut?: () => void;
}

export function AuthSignInOverlay({
  authProvider,
  authLoading,
  authError,
  onSignIn,
  onSignOut,
}: AuthSignInOverlayProps) {
  const viaLabel =
    authProvider === "google" || authProvider === "apple"
      ? authProvider === "google"
        ? "Google"
        : "Apple"
      : "Phantom";

  return (
    <div
      className="auth-signin-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-signin-title"
      data-testid="auth-signin-overlay"
    >
      <div className="auth-card auth-signin-card">
        <Logo size="md" className="auth-card-logo" />
        <h2 id="auth-signin-title">One more step</h2>
        <p>
          Wallet connected via {viaLabel}. Sign a free message to create your profile — no
          SOL required. The game keeps running behind this panel.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSignIn}
          disabled={authLoading}
          style={{ width: "100%" }}
          data-testid="connect-sign-in"
        >
          {authLoading ? "Signing…" : "Create profile & play"}
        </button>
        {onSignOut && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ width: "100%", marginTop: 8 }}
            onClick={onSignOut}
          >
            Use a different wallet
          </button>
        )}
        {authError && <div className="alert alert-error">{authError}</div>}
        <p className="auth-signin-footnote">{BRAND.shortName} · provably fair on Solana</p>
      </div>
    </div>
  );
}
