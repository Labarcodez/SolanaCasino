import { useState } from "react";
import { formatSol } from "../lib/api";
import { solscanTxUrl } from "../lib/utils";
import { useToast } from "./ui/Toast";

interface WalletPanelProps {
  balanceSol: number;
  onChainBalanceSol: number;
  minBetSol: number;
  minWithdrawSol: number;
  withdrawalsEnabled: boolean;
  onChainEnabled?: boolean;
  loading: boolean;
  onDeposit: (amount: number) => Promise<{ amountSol: number; signature?: string }>;
  onWithdraw: (amount: number) => Promise<{
    signature?: string;
    queued?: boolean;
    message?: string;
  }>;
  error: string | null;
}

export function WalletPanel({
  balanceSol,
  onChainBalanceSol,
  minBetSol,
  minWithdrawSol,
  withdrawalsEnabled,
  onChainEnabled,
  loading,
  onDeposit,
  onWithdraw,
  error,
}: WalletPanelProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("0.1");
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");

  const handleAction = async () => {
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
          disabled={loading}
        >
          {loading
            ? "Confirm in wallet..."
            : mode === "deposit"
              ? "Deposit SOL"
              : "Withdraw SOL"}
        </button>

        <p className="wallet-hint">
          {onChainEnabled
            ? "On-chain mode: funds go to the vault PDA via Anchor program."
            : "You'll sign a SOL transfer to the casino wallet."}
        </p>

        {!withdrawalsEnabled && mode === "withdraw" && (
          <p className="wallet-hint warning">Withdrawals queue until authority key is configured.</p>
        )}

        {error && <div className="alert alert-error">{error}</div>}
      </div>
    </div>
  );
}
