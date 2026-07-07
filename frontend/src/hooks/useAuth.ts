import { useCallback, useEffect, useState } from "react";
import bs58 from "bs58";
import { AddressType } from "@phantom/browser-sdk";
import { usePhantom, useSolana } from "@phantom/react-sdk";
import {
  requestAuthNonce,
  verifyAuth,
  setAuthToken,
  getAuthToken,
} from "../lib/api";

export function useAuth() {
  const { isConnected, addresses } = usePhantom();
  const { solana, isAvailable } = useSolana();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const solanaAccount = addresses.find(
    (a) => a.addressType === AddressType.solana,
  );
  const walletAddress = solanaAccount?.address;

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

      const result = await verifyAuth(walletAddress, signature, message);
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
  }, [walletAddress, solana, isAvailable]);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setIsAuthenticated(false);
      setAuthToken(null);
      return;
    }

    const existingToken = getAuthToken();
    if (existingToken) {
      setIsAuthenticated(true);
      return;
    }

    authenticate().catch(() => {
      // User may reject sign prompt on first connect
    });
  }, [isConnected, walletAddress, authenticate]);

  const signOut = useCallback(() => {
    setAuthToken(null);
    setIsAuthenticated(false);
  }, []);

  return {
    walletAddress,
    isConnected,
    isAuthenticated,
    authLoading,
    authError,
    authenticate,
    signOut,
  };
}
