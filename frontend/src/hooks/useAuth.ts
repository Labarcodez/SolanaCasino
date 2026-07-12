import { useCallback, useEffect, useRef, useState } from "react";
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
import { disconnectInjectedPhantom } from "../lib/injectedPhantom";
import { isMobileBrowser } from "../lib/phantomProviders";
import { isEmbeddedAuthProvider, signAuthMessage } from "../lib/walletSigning";
import { useInjectedPhantom } from "./useInjectedPhantom";

type PhantomUserExtended = {
  authProvider?: string;
  email?: string;
};

export function useAuth() {
  const { isConnected: sdkConnected, addresses, user: phantomUser } = usePhantom();
  const { solana, isAvailable } = useSolana();
  const { disconnect } = useDisconnect();
  const injected = useInjectedPhantom();
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasStoredSession());
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const solanaAccount = addresses.find(
    (a) => a.addressType === AddressType.solana,
  );
  const walletAddress = solanaAccount?.address ?? injected.address ?? undefined;
  const isConnected = sdkConnected || injected.connected;

  const authProvider = phantomUser?.authProvider ?? "injected";
  const phantomEmail = (phantomUser as PhantomUserExtended | null)?.email;
  const sessionWalletAddress = getSessionWalletAddress();
  const hasRestorableSession = Boolean(sessionWalletAddress && hasStoredSession());
  const authInFlightRef = useRef(false);
  const autoAuthAttemptedRef = useRef<string | null>(null);
  const solanaRef = useRef(solana);
  const isAvailableRef = useRef(isAvailable);

  useEffect(() => {
    solanaRef.current = solana;
    isAvailableRef.current = isAvailable;
  }, [solana, isAvailable]);

  const authenticate = useCallback(async () => {
    if (!walletAddress) {
      throw new Error("Wallet not connected");
    }
    if (authInFlightRef.current) {
      throw new Error(
        "Sign-in already in progress. Approve the message in Phantom or wait a moment.",
      );
    }

    authInFlightRef.current = true;
    setAuthLoading(true);
    setAuthError(null);

    try {
      const { message } = await requestAuthNonce(walletAddress);
      const signature = await signAuthMessage({
        message,
        sdkConnected,
        getSolana: () => solanaRef.current ?? undefined,
        getAvailable: () => isAvailableRef.current,
        useInjected: injected.connected && !sdkConnected,
        authProvider,
      });

      const result = await verifyAuth(walletAddress, signature, message, {
        authProvider,
        email: phantomEmail,
        referralCode: getStoredReferralCode() ?? undefined,
      });
      setAuthToken(result.token);
      setIsAuthenticated(true);
      autoAuthAttemptedRef.current = walletAddress;
      return result.token;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setAuthError(msg);
      setAuthToken(null);
      setIsAuthenticated(false);
      throw err;
    } finally {
      authInFlightRef.current = false;
      setAuthLoading(false);
    }
  }, [
    walletAddress,
    solana,
    isAvailable,
    sdkConnected,
    injected.connected,
    authProvider,
    phantomEmail,
  ]);

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

    // Embedded OAuth / deeplink: connect and sign must be separate user actions.
    if (isMobileBrowser() || isEmbeddedAuthProvider(authProvider)) {
      return;
    }

    if (autoAuthAttemptedRef.current === walletAddress) {
      return;
    }

    autoAuthAttemptedRef.current = walletAddress;
    authenticate().catch(() => {
      // User may reject sign prompt on first connect
    });
  }, [isConnected, walletAddress, authenticate, authProvider]);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setIsAuthenticated(false);
    setAuthError(null);
    autoAuthAttemptedRef.current = null;
    try {
      await disconnectInjectedPhantom();
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
