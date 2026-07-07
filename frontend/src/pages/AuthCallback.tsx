import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePhantom } from "@phantom/react-sdk";
import { useAuth } from "../hooks/useAuth";
import { Logo } from "../components/Logo";
import { SiteFooter } from "../components/SiteFooter";

export default function AuthCallback() {
  const { isConnected } = usePhantom();
  const { authenticate, isAuthenticated, authError } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConnected) {
      setLoading(false);
      return;
    }

    if (isAuthenticated) {
      navigate("/", { replace: true });
      return;
    }

    authenticate()
      .then(() => navigate("/", { replace: true }))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Sign in failed");
        setLoading(false);
      });
  }, [isConnected, isAuthenticated, authenticate, navigate]);

  const displayError = error ?? authError;

  return (
    <div className="app">
      <div className="auth-screen">
        <div className="auth-card">
          <Logo size="lg" className="auth-card-logo" />
          {loading && !displayError ? (
            <>
              <h2>Completing sign in...</h2>
              <p>Setting up your profile and wallet session.</p>
              <div className="spinner" style={{ margin: "16px auto" }} />
            </>
          ) : displayError ? (
            <>
              <h2>Sign in failed</h2>
              <div className="alert alert-error">{displayError}</div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 12 }}
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  void authenticate()
                    .then(() => navigate("/", { replace: true }))
                    .catch((err) => {
                      setError(err instanceof Error ? err.message : "Sign in failed");
                      setLoading(false);
                    });
                }}
              >
                Try again
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ width: "100%", marginTop: 8 }}
                onClick={() => navigate("/", { replace: true })}
              >
                Back to home
              </button>
            </>
          ) : (
            <>
              <h2>Wallet not connected</h2>
              <p>Connect your wallet and try signing in again.</p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 12 }}
                onClick={() => navigate("/", { replace: true })}
              >
                Back to home
              </button>
            </>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
