import { useCallback, useEffect, useState } from "react";
import { AddressType } from "@phantom/browser-sdk";
import { usePhantom, useSolana } from "@phantom/react-sdk";
import {
  fetchUser,
  verifyDeposit,
  withdraw,
  type UserProfile,
  type CasinoConfig,
  fetchConfig,
} from "../lib/api";
import { buildDepositTransaction } from "../lib/solana";

export function useCasinoUser() {
  const { isConnected, addresses } = usePhantom();
  const { solana, isAvailable } = useSolana();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [config, setConfig] = useState<CasinoConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const solanaAccount = addresses.find((a) => a.addressType === AddressType.solana);
  const walletAddress = solanaAccount?.address;

  const refresh = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const user = await fetchUser(walletAddress);
      setProfile(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchConfig().then(setConfig).catch(console.error);
  }, []);

  useEffect(() => {
    if (walletAddress) {
      refresh();
      const interval = setInterval(refresh, 10000);
      return () => clearInterval(interval);
    }
    setProfile(null);
  }, [walletAddress, refresh]);

  const deposit = useCallback(
    async (amountSol: number) => {
      if (!walletAddress || !solana || !isAvailable) {
        throw new Error("Wallet not connected");
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

        await new Promise((r) => setTimeout(r, 2000));

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
    [walletAddress, solana, isAvailable, refresh],
  );

  const withdrawFunds = useCallback(
    async (amountSol: number) => {
      if (!walletAddress) throw new Error("Wallet not connected");

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
    [walletAddress, refresh],
  );

  return {
    isConnected,
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
