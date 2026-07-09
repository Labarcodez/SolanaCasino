import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PhantomProvider, darkTheme } from "@phantom/react-sdk";
import { AddressType } from "@phantom/browser-sdk";
import App from "./App";
import "./index.css";
import "./theme.css";
import { PHANTOM_APP_ID } from "./lib/api";
import { BRAND } from "./lib/brand";
import { getPhantomProviders } from "./lib/phantomProviders";
import { captureReferralFromUrl, fetchConfig } from "./lib/api";
import { setSolanaCluster, setSolanaRpc } from "./lib/cluster";
import { ToastProvider } from "./components/ui/Toast";
import { ErrorBoundary } from "./components/ErrorBoundary";

const redirectUrl = `${window.location.origin}/auth/callback`;

captureReferralFromUrl();
void fetchConfig()
  .then((c) => {
    setSolanaCluster(c.cluster);
    if (c.solanaRpcUrl) {
      setSolanaRpc(c.solanaRpcUrl);
    }
  })
  .catch(() => setSolanaCluster("devnet"));

const providers = getPhantomProviders();
const appIcon = `${window.location.origin}/favicon.svg`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ErrorBoundary>
          <PhantomProvider
            config={{
              providers,
              ...(PHANTOM_APP_ID ? { appId: PHANTOM_APP_ID } : {}),
              addressTypes: [AddressType.solana],
              authOptions: { redirectUrl },
            }}
            theme={darkTheme}
            appName={BRAND.name}
            appIcon={appIcon}
          >
            <App />
          </PhantomProvider>
        </ErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
