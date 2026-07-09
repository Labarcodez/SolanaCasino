import { useCallback, useEffect, useState } from "react";
import bs58 from "bs58";
import { AddressType } from "@phantom/browser-sdk";
import { usePhantom, useSolana, useDisconnect } from "@phantom/react-sdk";
import {
  requestAuthNonce,
  verifyAuth,
  setAuthToken,
  getAuthToken,
  getStoredReferralCode,
  hasStoredSession,
  getSessionWalletAddress,
} from "../lib/api";
import { isMobileBrowser } from "../lib/phantomProviders";

type PhantomUserExtended = {
  authProvider?: string;
  email?: string;
};

export function useAuth() {
  const { isConnected, addresses, user: phantomUser } = usePhantom();
  const { solana, isAvailable } = useSolana();
  const { disconnect } = useDisconnect();
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasStoredSession());
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const solanaAccount = addresses.find(
    (a) => a.addressType === AddressType.solana,
  );
  const walletAddress = solanaAccount?.address;

  const authProvider = phantomUser?.authProvider ?? "injected";
  const phantomEmail = (phantomUser as PhantomUserExtended | null)?.email;
  const sessionWalletAddress = getSessionWalletAddress();
  const hasRestorableSession = Boolean(sessionWalletAddress && hasStoredSession());

  const authenticate = useCallback(async () => {
    if (!walletAddress || !solana || !isAvailable) {
      throw new Error("Wallet not connected");
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const { message } = await requestAuthNonce(walletAddress);
      const signResult = await solana.signMessage(message);
      const signature = bs58.encode(signResult.signature);

      const result = await verifyAuth(walletAddress, signature, message, {
        authProvider,
        email: phantomEmail,
        referralCode: getStoredReferralCode() ?? undefined,
      });
      setAuthToken(result.token);
      setIsAuthenticated(true);
      return result.token;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setAuthError(msg);
      setAuthToken(null);
      setIsAuthenticated(false);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  }, [walletAddress, solana, isAvailable, authProvider, phantomEmail]);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      // Keep JWT across refresh while Phantom reconnects — only drop auth if no token remains.
      setIsAuthenticated(hasStoredSession());
      return;
    }

    const existingToken = getAuthToken();
    const storedWallet = getSessionWalletAddress();

    if (existingToken && storedWallet && storedWallet !== walletAddress) {
      setAuthToken(null);
      setIsAuthenticated(false);
      setAuthError("Connected wallet does not match your saved session. Sign in again.");
      return;
    }

    if (existingToken) {
      setIsAuthenticated(true);
      setAuthError(null);
      return;
    }

    // Mobile / deeplink: connect and sign must be separate user actions (iOS deep-link limit).
    if (isMobileBrowser() || authProvider === "deeplink") {
      return;
    }

    authenticate().catch(() => {
      // User may reject sign prompt on first connect
    });
  }, [isConnected, walletAddress, authenticate, authProvider]);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setIsAuthenticated(false);
    setAuthError(null);
    try {
      await disconnect();
    } catch {
      // ignore disconnect errors
    }
  }, [disconnect]);

  return {
    walletAddress,
    isConnected,
    isAuthenticated,
    hasRestorableSession,
    sessionWalletAddress,
    authLoading,
    authError,
    authenticate,
    signOut,
    authProvider,
    phantomEmail,
  };
}
