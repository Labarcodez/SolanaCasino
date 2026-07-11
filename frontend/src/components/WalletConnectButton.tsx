import { useCallback, useState } from "react";
import { ConnectButton, useDisconnect, usePhantom } from "@phantom/react-sdk";
import { disconnectInjectedPhantom } from "../lib/injectedPhantom";
import { isPortalConfigured } from "../lib/phantomProviders";
import { useInjectedPhantom } from "../hooks/useInjectedPhantom";
import { ConnectTrigger } from "./ConnectTrigger";

/**
 * Header / landing connect control. Opens the unified ConnectModal when
 * disconnected; uses Phantom ConnectButton for wallet management when Portal
 * is configured and the user is already connected.
 */
export function WalletConnectButton() {
  const portalReady = isPortalConfigured();
  const { isConnected: sdkConnected } = usePhantom();
  const injected = useInjectedPhantom();
  const isConnected = sdkConnected || injected.connected;
  const { disconnect } = useDisconnect();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await disconnectInjectedPhantom();
      await disconnect();
    } catch (err) {
      console.error("Disconnect failed:", err);
    } finally {
      setDisconnecting(false);
    }
  }, [disconnect]);

  if (!isConnected) {
    return (
      <ConnectTrigger
        intent="play"
        label="Connect"
        testId="header-connect"
      />
    );
  }

  if (portalReady) {
    return <ConnectButton />;
  }

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      disabled={disconnecting}
      onClick={() => void handleDisconnect()}
    >
      {disconnecting ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
