import { useCallback, useEffect, useState } from "react";
import { useConnect, useDisconnect, useIsExtensionInstalled, usePhantom } from "@phantom/react-sdk";
import type { AuthProviderType } from "@phantom/browser-sdk";
import { useCasino } from "../hooks/CasinoUserProvider";
import { BRAND } from "../lib/brand";
import { Logo } from "./Logo";
import {
  connectInjectedPhantom,
  isInjectedPhantomInstalled,
} from "../lib/injectedPhantom";
import { isMobileBrowser, isPortalConfigured } from "../lib/phantomProviders";
import {
  isSecurePhantomContext,
  phantomSecureContextHint,
} from "../lib/phantomSecureContext";
import type { ConnectIntent } from "../context/ConnectModalContext";

interface ConnectModalProps {
  open: boolean;
  intent: ConnectIntent;
  onClose: () => void;
}

const INTENT_COPY: Record<ConnectIntent, { title: string; subtitle: string }> = {
  play: {
    title: "Connect to play",
    subtitle: "Deposit-first — fund once, bet instantly on crash, limbo, and coinflip.",
  },
  deposit: {
    title: "Connect your wallet",
    subtitle: "Sign in to deposit SOL and manage your casino balance.",
  },
  chat: {
    title: "Connect to chat",
    subtitle: "Join the live table chat after a quick wallet sign-in.",
  },
  general: {
    title: `Welcome to ${BRAND.shortName}`,
    subtitle: BRAND.description,
  },
};

type ModalStep = "providers" | "sign-in";

export function ConnectModal({ open, intent, onClose }: ConnectModalProps) {
  const {
    isConnected,
    isAuthenticated,
    authLoading,
    authError,
    authenticate,
    authProvider,
    walletAddress,
    config,
  } = useCasino();
  const { connect, isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { isInstalled: extensionInstalled } = useIsExtensionInstalled();
  const { isConnected: sdkConnected } = usePhantom();

  const [localError, setLocalError] = useState<string | null>(null);
  const [step, setStep] = useState<ModalStep>("providers");

  const portalReady =
    (config?.socialLoginEnabled ?? false) || isPortalConfigured();
  const secureContext = isSecurePhantomContext();
  const mobile = isMobileBrowser();
  const copy = INTENT_COPY[intent];

  useEffect(() => {
    if (!open) {
      setStep("providers");
      setLocalError(null);
      return;
    }
    if (isConnected && !isAuthenticated) {
      setStep("sign-in");
    } else {
      setStep("providers");
    }
  }, [open, isConnected, isAuthenticated]);

  useEffect(() => {
    if (open && isConnected && isAuthenticated) {
      onClose();
    }
  }, [open, isConnected, isAuthenticated, onClose]);

  const handleProvider = useCallback(
    async (provider: AuthProviderType) => {
      if (!secureContext && provider === "injected") {
        setLocalError(phantomSecureContextHint());
        return;
      }

      setLocalError(null);
      try {
        if (portalReady && provider !== "injected") {
          await connect({ provider });
        } else if (provider === "injected") {
          if (portalReady && sdkConnected) {
            await connect({ provider: "injected" });
          } else {
            await connectInjectedPhantom();
          }
        } else {
          setLocalError("Social login requires Phantom Portal (app ID).");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Connection failed";
        setLocalError(msg);
      }
    },
    [connect, portalReady, sdkConnected, secureContext],
  );

  const handleSignIn = useCallback(async () => {
    setLocalError(null);
    try {
      await authenticate();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setLocalError(msg);
    }
  }, [authenticate, onClose]);

  if (!open) return null;

  const showExtension =
    extensionInstalled || isInjectedPhantomInstalled() || !mobile;
  const errorMessage = localError ?? connectError?.message ?? authError;

  return (
    <div
      className="modal-overlay connect-modal-overlay"
      onClick={onClose}
      role="presentation"
      data-testid="connect-modal-overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-modal-title"
        className="modal card connect-modal"
        onClick={(e) => e.stopPropagation()}
        data-testid="connect-modal"
      >
        <button
          type="button"
          className="connect-modal-close btn-ghost"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <Logo size="md" className="connect-modal-logo" />
        <h2 id="connect-modal-title">{copy.title}</h2>
        <p className="connect-modal-subtitle">{copy.subtitle}</p>

        {step === "providers" && (
          <div className="connect-modal-providers">
            {!secureContext && (
              <p className="connect-modal-warning">{phantomSecureContextHint()}</p>
            )}

            {showExtension && (
              <button
                type="button"
                className="connect-provider-btn connect-provider-btn--phantom"
                disabled={isConnecting || !secureContext}
                onClick={() => void handleProvider("injected")}
                data-testid="connect-phantom-extension"
              >
                <span className="connect-provider-icon">◎</span>
                <span>
                  <strong>Phantom Extension</strong>
                  <small>Browser wallet · recommended on desktop</small>
                </span>
              </button>
            )}

            {mobile && portalReady && (
              <button
                type="button"
                className="connect-provider-btn"
                disabled={isConnecting}
                onClick={() => void handleProvider("deeplink")}
                data-testid="connect-phantom-app"
              >
                <span className="connect-provider-icon">📱</span>
                <span>
                  <strong>Phantom App</strong>
                  <small>Open the mobile app to connect</small>
                </span>
              </button>
            )}

            {portalReady ? (
              <>
                <button
                  type="button"
                  className="connect-provider-btn connect-provider-btn--google"
                  disabled={isConnecting}
                  onClick={() => void handleProvider("google")}
                  data-testid="connect-google"
                >
                  <span className="connect-provider-icon">G</span>
                  <span>
                    <strong>Continue with Google</strong>
                    <small>Embedded wallet · no extension needed</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="connect-provider-btn connect-provider-btn--apple"
                  disabled={isConnecting}
                  onClick={() => void handleProvider("apple")}
                  data-testid="connect-apple"
                >
                  <span className="connect-provider-icon"></span>
                  <span>
                    <strong>Continue with Apple</strong>
                    <small>Embedded wallet · Face ID / Touch ID</small>
                  </span>
                </button>
              </>
            ) : (
              <p className="connect-modal-hint">
                Google and Apple sign-in activate when the operator configures{" "}
                <a
                  href="https://phantom.com/portal"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Phantom Portal
                </a>
                .
              </p>
            )}

            {!showExtension && !portalReady && mobile && (
              <p className="connect-modal-hint">
                Install the{" "}
                <a
                  href="https://phantom.app/download"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Phantom app
                </a>{" "}
                to connect on mobile.
              </p>
            )}

            {isConnecting && (
              <p className="connect-modal-status" role="status">
                Waiting for wallet approval…
              </p>
            )}
          </div>
        )}

        {step === "sign-in" && isConnected && walletAddress && (
          <div className="connect-modal-signin">
            <p>
              Wallet connected
              {authProvider === "google" || authProvider === "apple"
                ? ` via ${authProvider === "google" ? "Google" : "Apple"}`
                : " via Phantom"}
              . Sign a free message to create your profile — no SOL required.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={authLoading}
              onClick={() => void handleSignIn()}
              data-testid="connect-sign-in"
            >
              {authLoading ? "Signing…" : "Create profile & play"}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => void disconnect()}
            >
              Use a different wallet
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="alert alert-error connect-modal-error">{errorMessage}</div>
        )}

        <p className="connect-modal-footnote">
          Deposit-first model — you sign deposits/withdrawals, not every bet.
        </p>
      </div>
    </div>
  );
}
