import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PhantomProvider, darkTheme } from "@phantom/react-sdk";
import { AddressType } from "@phantom/browser-sdk";
import App from "./App";
import "./index.css";
import { PHANTOM_APP_ID } from "./lib/api";

const redirectUrl = `${window.location.origin}/auth/callback`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PhantomProvider
      config={{
        providers: ["google", "apple", "injected"],
        appId: PHANTOM_APP_ID || "demo-app-id",
        addressTypes: [AddressType.solana],
        authOptions: { redirectUrl },
      }}
      theme={darkTheme}
    >
      <App />
    </PhantomProvider>
  </StrictMode>,
);
