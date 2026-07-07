import { useCallback, useEffect, useState } from "react";
import {
  fetchUser,
  verifyDeposit,
  withdraw,
  type UserProfile,
  type CasinoConfig,
  fetchConfig,
} from "../lib/api";
import { buildDepositTransaction } from "../lib/solana";
import { useAuth } from "./useAuth";
import { useSolana } from "@phantom/react-sdk";

export function useCasinoUser() {
  const {
    isConnected,
    walletAddress,
    isAuthenticated,
    authLoading,
    authError,
    authenticate,
  } = useAuth();
  const { solana, isAvailable } = useSolana();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [config, setConfig] = useState<CasinoConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!walletAddress || !isAuthenticated) return;
    try {
      const user = await fetchUser(walletAddress);
      setProfile(user);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    }
  }, [walletAddress, isAuthenticated]);

  useEffect(() => {
    fetchConfig().then(setConfig).catch(console.error);
  }, []);

  useEffect(() => {
    if (walletAddress && isAuthenticated) {
      refresh();
      const interval = setInterval(refresh, 10000);
      return () => clearInterval(interval);
    }
    setProfile(null);
  }, [walletAddress, isAuthenticated, refresh]);

  const deposit = useCallback(
    async (amountSol: number) => {
      if (!walletAddress || !solana || !isAvailable || !isAuthenticated) {
        throw new Error("Wallet not connected or not authenticated");
      }

      setLoading(true);
      setError(null);
      try {
        const tx = await buildDepositTransaction(walletAddress, amountSol);
        const result = await solana.signAndSendTransaction(tx);
        const signature = result.signature;

        if (!signature) {
          throw new Error("No transaction signature returned");
        }

        const depositResult = await verifyDeposit(signature, walletAddress);
        await refresh();
        return { signature, ...depositResult };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Deposit failed";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [walletAddress, solana, isAvailable, isAuthenticated, refresh],
  );

  const withdrawFunds = useCallback(
    async (amountSol: number) => {
      if (!walletAddress || !isAuthenticated) {
        throw new Error("Wallet not connected or not authenticated");
      }

      setLoading(true);
      setError(null);
      try {
        const result = await withdraw(walletAddress, amountSol);
        await refresh();
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Withdrawal failed";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [walletAddress, isAuthenticated, refresh],
  );

  return {
    isConnected,
    isAuthenticated,
    authLoading,
    authError,
    authenticate,
    walletAddress,
    profile,
    config,
    loading,
    error,
    deposit,
    withdraw: withdrawFunds,
    refresh,
  };
}
