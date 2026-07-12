import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConnectBox, usePhantom } from "@phantom/react-sdk";
import { useAuth } from "../hooks/useAuth";
import { AuthSignInOverlay } from "../components/AuthSignInOverlay";
import { Logo } from "../components/Logo";
import { SiteFooter } from "../components/SiteFooter";

export default function AuthCallback() {
  const { isConnected } = usePhantom();
  const { authenticate, isAuthenticated, authLoading, authError, authProvider } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/crash", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const displayError = error ?? authError;

  if (!isConnected) {
    return (
      <div className="app">
        <div className="auth-screen">
          <div className="auth-card">
            <Logo size="lg" className="auth-card-logo" />
            <h2>Finish connecting</h2>
            <p>Complete wallet setup below, then return to play.</p>
            <ConnectBox maxWidth="100%" />
            <button
              type="button"
              className="btn btn-outline"
              style={{ width: "100%", marginTop: 12 }}
              onClick={() => navigate("/crash", { replace: true })}
            >
              Back to crash
            </button>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="app auth-callback-app">
      <AuthSignInOverlay
        authProvider={authProvider}
        authLoading={authLoading}
        authError={displayError}
        onSignIn={() => {
          setError(null);
          void authenticate()
            .then(() => navigate("/crash", { replace: true }))
            .catch((err) => {
              setError(err instanceof Error ? err.message : "Sign in failed");
            });
        }}
      />
      <SiteFooter />
    </div>
  );
}
