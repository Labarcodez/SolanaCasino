import { useState } from "react";
import { formatSol } from "../lib/api";
import { solscanTxUrl } from "../lib/utils";
import { useToast } from "./ui/Toast";
import type { PendingWalletTx, WalletActionPhase } from "../hooks/useCasinoUser";
import { TxStatusBanner } from "./TxStatusBanner";

interface WalletPanelProps {
  balanceSol: number;
  onChainBalanceSol: number;
  minBetSol: number;
  minWithdrawSol: number;
  withdrawalsEnabled: boolean;
  onChainEnabled?: boolean;
  loading: boolean;
  walletActionPhase?: WalletActionPhase;
  pendingWalletTx?: PendingWalletTx | null;
  onDeposit: (amount: number) => Promise<{ amountSol: number; signature?: string }>;
  onWithdraw: (amount: number) => Promise<{
    signature?: string;
    queued?: boolean;
    pending?: boolean;
    message?: string;
    balanceSol?: number;
  }>;
  error: string | null;
  rpcProvider?: "alchemy" | "helius" | "custom" | "public";
  alchemyConfigured?: boolean;
  cluster?: string;
  onRecoverPendingDeposit: () => Promise<boolean>;
  onCreditDeposit: (signature: string) => Promise<{ balanceSol: number; signature: string }>;
}

export function WalletPanel({
  balanceSol,
  onChainBalanceSol,
  minBetSol,
  minWithdrawSol,
  withdrawalsEnabled,
  onChainEnabled,
  loading,
  walletActionPhase = "idle",
  pendingWalletTx = null,
  onDeposit,
  onWithdraw,
  error,
  rpcProvider,
  alchemyConfigured,
  cluster,
  onRecoverPendingDeposit,
  onCreditDeposit,
}: WalletPanelProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("0.1");
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [recoverySig, setRecoverySig] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);

  const isMainnet = cluster === "mainnet-beta" || cluster === "mainnet";
  const rpcMisconfigured = isMainnet && alchemyConfigured === false && rpcProvider === "public";

  const handleAction = async () => {
    if (mode === "deposit" && rpcMisconfigured) {
      toast(
        "Deposits are temporarily unavailable. Please try again in a few minutes.",
        "error",
      );
      return;
    }

    if (mode === "withdraw" && !withdrawalsEnabled) {
      toast(
        "Withdrawals are temporarily paused. Your balance is safe — try again later.",
        "error",
      );
      return;
    }

    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      toast("Enter a valid amount greater than 0", "error");
      return;
    }

    const min = mode === "deposit" ? minBetSol : minWithdrawSol;
    if (value < min) {
      toast(`Minimum ${mode} is ${min} SOL`, "error");
      return;
    }

    if (mode === "withdraw" && value > balanceSol) {
      toast("Insufficient casino balance", "error");
      return;
    }

    try {
      if (mode === "deposit") {
        const result = await onDeposit(value);
        toast(`Deposited ${formatSol(result.amountSol)} SOL`, "success", result.signature
          ? { label: "View tx", href: solscanTxUrl(result.signature) }
          : undefined);
      } else {
        const result = await onWithdraw(value);
        if (result.pending) {
          toast(
            result.message ??
              "Withdrawal sent — balance will update once confirmed on-chain.",
            "info",
            result.signature
              ? { label: "View tx", href: solscanTxUrl(result.signature) }
              : undefined,
          );
        } else if (result.queued) {
          toast(result.message ?? "Withdrawal queued", "info");
        } else {
          toast(`Withdrew ${value} SOL`, "success", result.signature
            ? { label: "View tx", href: solscanTxUrl(result.signature) }
            : undefined);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast(msg, "error");
      if (mode === "withdraw") {
        toast("Refreshing balance — if SOL arrived in your wallet, the casino balance should update.", "info");
      }
    }
  };

  const actionLabel = loading
    ? walletActionPhase === "confirming"
      ? mode === "deposit"
        ? "Confirming deposit..."
        : "Processing withdrawal..."
      : "Confirm in wallet..."
    : mode === "deposit"
      ? "Deposit SOL"
      : "Withdraw SOL";

  return (
    <div className="card wallet-panel">
      <h3 className="card-title">Wallet</h3>

      <div className="wallet-stats">
        <div className="stat-box">
          <div className="label">Casino balance</div>
          <div className="value" style={{ color: "var(--solana-green)" }}>
            {formatSol(balanceSol)} SOL
          </div>
        </div>
        <div className="stat-box">
          <div className="label">Wallet balance</div>
          <div className="value">{formatSol(onChainBalanceSol)} SOL</div>
        </div>
      </div>

      <TxStatusBanner
        phase={walletActionPhase}
        flow={pendingWalletTx?.flow ?? "idle"}
        signature={pendingWalletTx?.signature}
        amountSol={pendingWalletTx?.amountSol}
      />

      <div className="actions">
        <div className="wallet-mode-toggle">
          <button
            type="button"
            className={`btn btn-sm ${mode === "deposit" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setMode("deposit")}
          >
            Deposit
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === "withdraw" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setMode("withdraw")}
          >
            Withdraw
          </button>
        </div>

        <div className="input-group">
          <label>Amount (SOL)</label>
          <input
            className="input"
            type="number"
            step="0.001"
            min={mode === "deposit" ? minBetSol : minWithdrawSol}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="bet-amount-presets">
          {["0.01", "0.05", "0.1", "0.5", "1"].map((preset) => (
            <button
              key={preset}
              type="button"
              className="preset-btn"
              onClick={() => setAmount(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`btn ${mode === "deposit" ? "btn-success" : "btn-secondary"}`}
          onClick={handleAction}
          disabled={
            loading ||
            (mode === "withdraw" && !withdrawalsEnabled) ||
            (mode === "deposit" && rpcMisconfigured)
          }
        >
          {actionLabel}
        </button>

        <p className="wallet-hint">
          {onChainEnabled
            ? "Deposit-first: fund your vault once, then bet instantly from casino balance."
            : "Deposit SOL to your casino balance — one signature, then instant bets."}
        </p>

        {!withdrawalsEnabled && mode === "withdraw" && (
          <p className="wallet-hint warning">
            Withdrawals are temporarily paused. Your casino balance is safe — payouts
            resume when the operator enables them.
          </p>
        )}

        {rpcMisconfigured && mode === "deposit" && (
          <p className="wallet-hint warning">
            Deposits may take longer to confirm right now. If SOL left your wallet but
            balance did not update, use recovery below.
          </p>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        {mode === "deposit" && !onChainEnabled && (
          <div className="wallet-recovery">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setShowRecovery((v) => !v)}
            >
              {showRecovery ? "Hide" : "Deposit sent but balance is 0?"}
            </button>
            {showRecovery && (
              <div className="wallet-recovery-panel">
                <p className="wallet-hint">
                  If SOL left your wallet but Casino balance did not update, paste the Solscan
                  transaction signature to credit it.
                </p>
                <input
                  type="text"
                  className="input"
                  placeholder="Transaction signature"
                  value={recoverySig}
                  onChange={(e) => setRecoverySig(e.target.value)}
                />
                <div className="wallet-recovery-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={loading || !recoverySig.trim()}
                    onClick={() => {
                      void (async () => {
                        try {
                          const result = await onCreditDeposit(recoverySig.trim());
                          toast(`Credited ${formatSol(result.balanceSol)} SOL`, "success", {
                            label: "View tx",
                            href: solscanTxUrl(result.signature),
                          });
                          setRecoverySig("");
                        } catch (err) {
                          toast(
                            err instanceof Error ? err.message : "Could not credit deposit",
                            "error",
                          );
                        }
                      })();
                    }}
                  >
                    Credit deposit
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={loading}
                    onClick={() => {
                      void (async () => {
                        const ok = await onRecoverPendingDeposit();
                        toast(
                          ok
                            ? "Pending deposit credited"
                            : "No pending deposit found — paste signature above",
                          ok ? "success" : "info",
                        );
                      })();
                    }}
                  >
                    Retry last deposit
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
