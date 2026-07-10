import { useState } from "react";
import { formatSol } from "../lib/api";
import { solscanTxUrl } from "../lib/utils";
import { useToast } from "./ui/Toast";
import type { WalletActionPhase } from "../hooks/useCasinoUser";

interface WalletPanelProps {
  balanceSol: number;
  onChainBalanceSol: number;
  minBetSol: number;
  minWithdrawSol: number;
  withdrawalsEnabled: boolean;
  onChainEnabled?: boolean;
  loading: boolean;
  walletActionPhase?: WalletActionPhase;
  onDeposit: (amount: number) => Promise<{ amountSol: number; signature?: string }>;
  onWithdraw: (amount: number) => Promise<{
    signature?: string;
    queued?: boolean;
    message?: string;
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
        "Deposits are unavailable — the server is not connected to Alchemy. Set ALCHEMY_API_KEY in production env and redeploy.",
        "error",
      );
      return;
    }

    if (mode === "withdraw" && !withdrawalsEnabled) {
      toast(
        "Withdrawals are unavailable — the server payout wallet is not configured. Set CASINO_WALLET_PRIVATE_KEY in production env and redeploy.",
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
        if (result.queued) {
          toast(result.message ?? "Withdrawal queued", "info");
        } else {
          toast(`Withdrew ${value} SOL`, "success", result.signature
            ? { label: "View tx", href: solscanTxUrl(result.signature) }
            : undefined);
        }
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Transaction failed", "error");
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
          <div className="label">Casino</div>
          <div className="value" style={{ color: "var(--solana-green)" }}>
            {formatSol(balanceSol)}
          </div>
        </div>
        <div className="stat-box">
          <div className="label">Wallet SOL</div>
          <div className="value">{formatSol(onChainBalanceSol)}</div>
        </div>
      </div>

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
            ? "On-chain mode: funds go to the vault PDA via Anchor program."
            : "You'll sign a SOL transfer to the casino wallet."}
        </p>

        {!withdrawalsEnabled && mode === "withdraw" && (
          <p className="wallet-hint warning">
            Withdrawals are disabled until <code>CASINO_WALLET_PRIVATE_KEY</code> is set on the
            server. Your casino balance is safe — SOL is not sent until payouts are enabled.
          </p>
        )}

        {rpcMisconfigured && mode === "deposit" && (
          <p className="wallet-hint warning">
            Server RPC is not connected to Alchemy (using public mainnet RPC). Deposits will not
            confirm reliably until <code>ALCHEMY_API_KEY</code> is set in production
            environment variables and the app is redeployed.
          </p>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        {mode === "deposit" && (
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
