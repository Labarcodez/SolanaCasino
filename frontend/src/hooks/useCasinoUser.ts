import { useCallback, useEffect, useState } from "react";
import { Transaction } from "@solana/web3.js";
import {
  fetchUser,
  verifyDeposit,
  prepareDeposit,
  withdraw,
  type UserProfile,
  type CasinoConfig,
  fetchConfig,
} from "../lib/api";
import {
  depositOnChain,
  normalizeTxSignature,
  transactionFromBase64,
  withdrawOnChain,
  type TxSignature,
} from "../lib/solana";
import { setSolanaCluster, setSolanaRpc } from "../lib/cluster";
import { useAuth } from "./useAuth";
import { useSolana } from "@phantom/react-sdk";

export type WalletActionPhase = "idle" | "signing" | "confirming";

const PENDING_DEPOSIT_KEY = "solcasino_pending_deposit";

interface PendingDeposit {
  signature: string;
  walletAddress: string;
  ts: number;
}

function savePendingDeposit(signature: string, walletAddress: string): void {
  const payload: PendingDeposit = { signature, walletAddress, ts: Date.now() };
  localStorage.setItem(PENDING_DEPOSIT_KEY, JSON.stringify(payload));
}

function clearPendingDeposit(): void {
  localStorage.removeItem(PENDING_DEPOSIT_KEY);
}

function readPendingDeposit(walletAddress: string): PendingDeposit | null {
  const raw = localStorage.getItem(PENDING_DEPOSIT_KEY);
  if (!raw) return null;

  try {
    const pending = JSON.parse(raw) as PendingDeposit;
    if (pending.walletAddress !== walletAddress) return null;
    if (Date.now() - pending.ts > 24 * 60 * 60 * 1000) {
      clearPendingDeposit();
      return null;
    }
    return pending;
  } catch {
    clearPendingDeposit();
    return null;
  }
}

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

  const patchProfileBalance = useCallback((balanceSol: number) => {
    setProfile((prev) => (prev ? { ...prev, balanceSol } : prev));
  }, []);

  const handleBalanceUpdate = useCallback(
    (balanceSol: number) => {
      patchProfileBalance(balanceSol);
      void refresh();
    },
    [patchProfileBalance, refresh],
  );

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const c = await fetchConfig();
      setConfig(c);
      setSolanaCluster(c.cluster);
      if (c.clientRpcUrl) {
        setSolanaRpc(c.clientRpcUrl);
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

  const recoverPendingDeposit = useCallback(async (): Promise<boolean> => {
    if (!walletAddress || !isAuthenticated) return false;

    const pending = readPendingDeposit(walletAddress);
    if (!pending) return false;

    setWalletActionPhase("confirming");
    setError(null);
    try {
      const depositResult = await verifyDeposit(pending.signature, walletAddress);
      patchProfileBalance(depositResult.balanceSol);
      clearPendingDeposit();
      await refresh();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Deposit recovery failed";
      setError(msg);
      return false;
    } finally {
      setWalletActionPhase("idle");
    }
  }, [walletAddress, isAuthenticated, patchProfileBalance, refresh]);

  useEffect(() => {
    if (!walletAddress || !isAuthenticated) return;
    void recoverPendingDeposit();
  }, [walletAddress, isAuthenticated, recoverPendingDeposit]);

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
          patchProfileBalance(result.balanceSol);
          await refresh();
          return { signature: result.signature, success: true, amountSol, balanceSol: result.balanceSol };
        }

        const casinoWallet = config?.casinoWallet;
        if (!casinoWallet) {
          throw new Error("Casino wallet not configured");
        }

        if (
          config.cluster === "mainnet-beta" &&
          config.alchemyConfigured === false &&
          config.rpcProvider === "public"
        ) {
          throw new Error(
            "Deposits unavailable: server is not connected to Alchemy. Set ALCHEMY_API_KEY in Render and redeploy.",
          );
        }

        const { transaction: serializedTx } = await prepareDeposit(
          walletAddress,
          amountSol,
        );
        const tx = transactionFromBase64(serializedTx);

        const signResult = await solana.signAndSendTransaction(tx);
        const signature = signResult.signature
          ? normalizeTxSignature(signResult.signature as TxSignature)
          : null;

        if (!signature) {
          throw new Error("No transaction signature returned");
        }

        savePendingDeposit(signature, walletAddress);
        setWalletActionPhase("confirming");
        const depositResult = await verifyDeposit(signature, walletAddress);
        clearPendingDeposit();
        patchProfileBalance(depositResult.balanceSol);
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
    [walletAddress, solana, isAvailable, isAuthenticated, config, signAndSendTx, refresh, patchProfileBalance],
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
          patchProfileBalance(result.balanceSol);
          await refresh();
          return { signature: result.signature, balanceSol: result.balanceSol };
        }

        setWalletActionPhase("confirming");
        const result = await withdraw(walletAddress, amountSol);
        if (result.balanceSol !== undefined) {
          patchProfileBalance(result.balanceSol);
        }
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
    [walletAddress, isAuthenticated, config, signAndSendTx, refresh, patchProfileBalance],
  );

  const creditDepositBySignature = useCallback(
    async (signature: string) => {
      if (!walletAddress || !isAuthenticated) {
        throw new Error("Wallet not connected or not authenticated");
      }

      setWalletActionPhase("confirming");
      setError(null);
      try {
        const normalized = normalizeTxSignature(signature.trim());
        const depositResult = await verifyDeposit(normalized, walletAddress);
        clearPendingDeposit();
        patchProfileBalance(depositResult.balanceSol);
        await refresh();
        return { signature: normalized, ...depositResult };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Deposit credit failed";
        setError(msg);
        throw err;
      } finally {
        setWalletActionPhase("idle");
      }
    },
    [walletAddress, isAuthenticated, patchProfileBalance, refresh],
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
    handleBalanceUpdate,
    recoverPendingDeposit,
    creditDepositBySignature,
    signAndSendTx,
  };
}
