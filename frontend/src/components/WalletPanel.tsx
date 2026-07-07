import { useState } from "react";
import { formatSol } from "../lib/api";

interface WalletPanelProps {
  balanceSol: number;
  onChainBalanceSol: number;
  minBetSol: number;
  minWithdrawSol: number;
  withdrawalsEnabled: boolean;
  loading: boolean;
  onDeposit: (amount: number) => Promise<{ amountSol: number }>;
  onWithdraw: (amount: number) => Promise<{ signature: string }>;
  error: string | null;
}

export function WalletPanel({
  balanceSol,
  onChainBalanceSol,
  minBetSol,
  minWithdrawSol,
  withdrawalsEnabled,
  loading,
  onDeposit,
  onWithdraw,
  error,
}: WalletPanelProps) {
  const [amount, setAmount] = useState("0.1");
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [message, setMessage] = useState<string | null>(null);

  const handleAction = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) return;

    setMessage(null);
    try {
      if (mode === "deposit") {
        const result = await onDeposit(value);
        setMessage(`Deposited ${formatSol(result.amountSol)} SOL successfully!`);
      } else {
        const result = await onWithdraw(value);
        setMessage(
          `Withdrawn ${value} SOL! Tx: ${result.signature.slice(0, 8)}...`,
        );
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Transaction failed");
    }
  };

  return (
    <div className="card wallet-panel">
      <h3 className="card-title">💰 Wallet</h3>

      <div className="wallet-stats">
        <div className="stat-box">
          <div className="label">Casino Balance</div>
          <div className="value" style={{ color: "var(--solana-green)" }}>
            {formatSol(balanceSol)} SOL
          </div>
        </div>
        <div className="stat-box">
          <div className="label">On-Chain</div>
          <div className="value">{formatSol(onChainBalanceSol)} SOL</div>
        </div>
      </div>

      <div className="actions">
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={`btn btn-sm ${mode === "deposit" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setMode("deposit")}
          >
            Deposit
          </button>
          <button
            className={`btn btn-sm ${mode === "withdraw" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setMode("withdraw")}
            disabled={!withdrawalsEnabled}
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
              className="preset-btn"
              onClick={() => setAmount(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        <button
          className={`btn ${mode === "deposit" ? "btn-success" : "btn-primary"} btn-sm`}
          onClick={handleAction}
          disabled={loading}
        >
          {loading
            ? "Processing..."
            : mode === "deposit"
              ? "Deposit SOL"
              : "Withdraw SOL"}
        </button>

        {mode === "deposit" && (
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            You'll sign a real SOL transfer to the casino wallet on Solana
            mainnet.
          </p>
        )}

        {!withdrawalsEnabled && mode === "withdraw" && (
          <p style={{ fontSize: "0.75rem", color: "var(--warning)" }}>
            Automated withdrawals require server configuration.
          </p>
        )}

        {error && <div className="alert alert-error">{error}</div>}
        {message && (
          <div
            className={`alert ${message.includes("success") || message.includes("Deposited") || message.includes("Withdrawn") ? "alert-success" : "alert-error"}`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
