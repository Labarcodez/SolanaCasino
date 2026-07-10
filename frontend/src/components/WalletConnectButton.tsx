import { ConnectButton, useConnect, useDisconnect, usePhantom } from "@phantom/react-sdk";
import { isPortalConfigured } from "../lib/phantomProviders";

/**
 * Phantom's ConnectButton modal can hang on plain HTTP hosts (e.g. AWS ALB)
 * when no Phantom Portal appId is configured. Use direct extension connect instead.
 */
export function WalletConnectButton() {
  const portalReady = isPortalConfigured();
  const { isConnected } = usePhantom();
  const { connect, isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  if (portalReady) {
    return <ConnectButton />;
  }

  if (isConnected) {
    return (
      <button type="button" className="btn btn-outline" onClick={() => void disconnect()}>
        Disconnect
      </button>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={isConnecting}
      onClick={() => {
        void connect({ provider: "injected" }).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Connection failed";
          console.error("Phantom connect failed:", msg);
          window.alert(
            "Could not connect to Phantom. Install the Phantom extension for Chrome/Brave/Edge, then try again.",
          );
        });
      }}
    >
      {isConnecting ? "Connecting..." : "Connect Phantom"}
    </button>
  );
}
