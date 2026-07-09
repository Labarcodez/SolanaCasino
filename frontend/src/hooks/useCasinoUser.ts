import { useCallback, useEffect, useState } from "react";
import { Transaction } from "@solana/web3.js";
import {
  fetchUser,
  verifyDeposit,
  withdraw,
  type UserProfile,
  type CasinoConfig,
  fetchConfig,
} from "../lib/api";
import {
  buildDepositTransaction,
  depositOnChain,
  normalizeTxSignature,
  waitForTransactionConfirmation,
  withdrawOnChain,
  type TxSignature,
} from "../lib/solana";
import { setSolanaCluster, setSolanaRpc } from "../lib/cluster";
import { useAuth } from "./useAuth";
import { useSolana } from "@phantom/react-sdk";

export type WalletActionPhase = "idle" | "signing" | "confirming";

export function useCasinoUser() {
  const {
    isConnected,
    walletAddress,
    isAuthenticated,
    hasRestorableSession,
    sessionWalletAddress,
    authLoading,
    authError,
    authenticate,
    signOut,
    authProvider,
  } = useAuth();
  const { solana, isAvailable } = useSolana();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [config, setConfig] = useState<CasinoConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [walletActionPhase, setWalletActionPhase] = useState<WalletActionPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const walletLoading = walletActionPhase !== "idle";

  const signAndSendTx = useCallback(
    async (tx: Transaction) => {
      if (!solana || !isAvailable) {
        throw new Error("Wallet not available");
      }
      const result = await solana.signAndSendTransaction(tx);
      if (!result.signature) {
        throw new Error("No transaction signature returned");
      }
      return { signature: normalizeTxSignature(result.signature as TxSignature) };
    },
    [solana, isAvailable],
  );

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

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const c = await fetchConfig();
      setConfig(c);
      setSolanaCluster(c.cluster);
      if (c.solanaRpcUrl) {
        setSolanaRpc(c.solanaRpcUrl);
      }
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Failed to load config");
      setConfig(null);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

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

      setWalletActionPhase("signing");
      setError(null);
      try {
        if (config?.onChainEnabled) {
          const result = await depositOnChain(
            walletAddress,
            amountSol,
            signAndSendTx,
          );
          await refresh();
          return { signature: result.signature, success: true, amountSol, balanceSol: result.balanceSol };
        }

        const casinoWallet = config?.casinoWallet;
        if (!casinoWallet) {
          throw new Error("Casino wallet not configured");
        }

        const tx = await buildDepositTransaction(
          walletAddress,
          amountSol,
          casinoWallet,
          config.solanaRpcUrl,
        );

        const signResult = await solana.signAndSendTransaction(tx);
        const signature = signResult.signature
          ? normalizeTxSignature(signResult.signature as TxSignature)
          : null;

        if (!signature) {
          throw new Error("No transaction signature returned");
        }

        setWalletActionPhase("confirming");
        await waitForTransactionConfirmation(signature, 90_000, config.solanaRpcUrl);
        const depositResult = await verifyDeposit(signature, walletAddress);
        await refresh();
        return { signature, ...depositResult };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Deposit failed";
        setError(msg);
        throw err;
      } finally {
        setWalletActionPhase("idle");
      }
    },
    [walletAddress, solana, isAvailable, isAuthenticated, config, signAndSendTx, refresh],
  );

  const withdrawFunds = useCallback(
    async (amountSol: number) => {
      if (!walletAddress || !isAuthenticated) {
        throw new Error("Wallet not connected or not authenticated");
      }

      setWalletActionPhase("signing");
      setError(null);
      try {
        if (config?.onChainEnabled) {
          const result = await withdrawOnChain(
            walletAddress,
            amountSol,
            signAndSendTx,
          );
          await refresh();
          return { signature: result.signature, balanceSol: result.balanceSol };
        }

        setWalletActionPhase("confirming");
        const result = await withdraw(walletAddress, amountSol);
        await refresh();
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Withdrawal failed";
        setError(msg);
        throw err;
      } finally {
        setWalletActionPhase("idle");
      }
    },
    [walletAddress, isAuthenticated, config, signAndSendTx, refresh],
  );

  return {
    isConnected,
    isAuthenticated,
    hasRestorableSession,
    sessionWalletAddress,
    authLoading,
    authError,
    authenticate,
    signOut,
    authProvider,
    walletAddress,
    profile,
    config,
    configLoading,
    configError,
    reloadConfig: loadConfig,
    loading: walletLoading,
    walletActionPhase,
    error,
    deposit,
    withdraw: withdrawFunds,
    refresh,
    signAndSendTx,
  };
}
