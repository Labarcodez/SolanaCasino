import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PhantomProvider, darkTheme } from "@phantom/react-sdk";
import { AddressType } from "@phantom/browser-sdk";
import App from "./App";
import "./index.css";
import { PHANTOM_APP_ID } from "./lib/api";

const redirectUrl = `${window.location.origin}/auth/callback`;

const providers: Array<"google" | "apple" | "injected"> = PHANTOM_APP_ID
  ? ["google", "apple", "injected"]
  : ["injected"];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PhantomProvider
      config={{
        providers,
        ...(PHANTOM_APP_ID ? { appId: PHANTOM_APP_ID } : {}),
        addressTypes: [AddressType.solana],
        authOptions: { redirectUrl },
      }}
      theme={darkTheme}
      appName="SolCasino"
    >
      <App />
    </PhantomProvider>
  </StrictMode>,
);
