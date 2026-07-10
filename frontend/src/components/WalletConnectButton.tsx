import { useCallback, useState } from "react";
import { ConnectButton, useDisconnect, usePhantom } from "@phantom/react-sdk";
import {
  connectInjectedPhantom,
  disconnectInjectedPhantom,
  isInjectedPhantomInstalled,
} from "../lib/injectedPhantom";
import { isPortalConfigured } from "../lib/phantomProviders";
import {
  isSecurePhantomContext,
  phantomSecureContextHint,
} from "../lib/phantomSecureContext";
import { useInjectedPhantom } from "../hooks/useInjectedPhantom";

/**
 * Phantom's SDK connect flow can hang on plain HTTP (AWS ALB). Extension-only
 * production uses direct window.phantom.solana.connect().
 */
export function WalletConnectButton() {
  const portalReady = isPortalConfigured();
  const secureContext = isSecurePhantomContext();
  const { isConnected: sdkConnected } = usePhantom();
  const injected = useInjectedPhantom();
  const isConnected = sdkConnected || injected.connected;
  const { disconnect } = useDisconnect();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    if (!secureContext) {
      setError(phantomSecureContextHint());
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      await connectInjectedPhantom();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg);
      console.error("Phantom connect failed:", msg);
    } finally {
      setConnecting(false);
    }
  }, [secureContext]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnectInjectedPhantom();
      await disconnect();
    } catch (err) {
      console.error("Disconnect failed:", err);
    }
  }, [disconnect]);

  if (portalReady) {
    return <ConnectButton />;
  }

  if (isConnected) {
    return (
      <button type="button" className="btn btn-outline" onClick={() => void handleDisconnect()}>
        Disconnect
      </button>
    );
  }

  const extensionMissing = secureContext && !isInjectedPhantomInstalled();

  return (
    <div className="wallet-connect-wrap">
      {!secureContext && (
        <p className="wallet-connect-error wallet-connect-secure-warning">
          {phantomSecureContextHint()}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary"
        disabled={connecting || !secureContext}
        onClick={() => void handleConnect()}
      >
        {connecting ? "Connecting..." : "Connect Phantom"}
      </button>
      {extensionMissing && !connecting && (
        <p className="wallet-connect-hint">
          Phantom extension not detected — install it and refresh.
        </p>
      )}
      {error && <p className="wallet-connect-error">{error}</p>}
    </div>
  );
}
