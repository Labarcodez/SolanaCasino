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
import { captureReferralFromUrl, fetchConfig } from "./lib/api";
import { setSolanaCluster } from "./lib/cluster";
import { ToastProvider } from "./components/ui/Toast";
import { ErrorBoundary } from "./components/ErrorBoundary";

const redirectUrl = `${window.location.origin}/auth/callback`;

captureReferralFromUrl();
void fetchConfig()
  .then((c) => setSolanaCluster(c.cluster))
  .catch(() => setSolanaCluster("devnet"));

const providers: Array<"google" | "apple" | "injected"> = PHANTOM_APP_ID
  ? ["google", "apple", "injected"]
  : ["injected"];

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
          >
            <App />
          </PhantomProvider>
        </ErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
