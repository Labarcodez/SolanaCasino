import { useState } from "react";
import { useCrashSubscription } from "../hooks/useSocket";
import { formatSol } from "../lib/api";

interface CrashGameProps {
  walletAddress: string;
  balanceSol: number;
  minBetSol: number;
  maxBetSol: number;
  onBalanceUpdate: (balance: number) => void;
}

function getHistoryClass(crashPoint: number): string {
  if (crashPoint < 1.5) return "low";
  if (crashPoint < 3) return "mid";
  return "high";
}

export function CrashGame({
  walletAddress,
  balanceSol,
  minBetSol,
  maxBetSol,
  onBalanceUpdate,
}: CrashGameProps) {
  const { crashState, placeBet, cashout } = useCrashSubscription(walletAddress);
  const [betAmount, setBetAmount] = useState("0.01");
  const [autoCashout, setAutoCashout] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const phase = crashState?.phase ?? "betting";
  const multiplier = crashState?.multiplier ?? 1.0;
  const myBet = crashState?.myBets?.find((b) => !b.cashedOut);
  const hasActiveBet = !!myBet;

  const rocketBottom = Math.min(20 + (multiplier - 1) * 15, 75);

  const handleBet = async () => {
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < minBetSol || amount > maxBetSol) {
      setMessage(`Bet must be between ${minBetSol} and ${maxBetSol} SOL`);
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const auto = autoCashout ? parseFloat(autoCashout) : undefined;
      const result = await placeBet(amount, auto);
      if (result.success && result.balanceSol !== undefined) {
        onBalanceUpdate(result.balanceSol);
        setMessage(`Bet placed: ${amount} SOL`);
      } else {
        setMessage(result.error ?? "Bet failed");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Bet failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCashout = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await cashout();
      if (result.success && result.balanceSol !== undefined) {
        onBalanceUpdate(result.balanceSol);
        setMessage("Cashed out successfully!");
      } else {
        setMessage(result.error ?? "Cashout failed");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Cashout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3 className="card-title" style={{ margin: 0 }}>
          🚀 Crash
        </h3>
        <span className={`phase-badge ${phase}`}>{phase}</span>
      </div>

      {crashState?.history && crashState.history.length > 0 && (
        <div className="crash-history">
          {crashState.history.slice(0, 12).map((h) => (
            <span
              key={h.roundId}
              className={`history-pill ${getHistoryClass(h.crashPoint)}`}
            >
              {h.crashPoint.toFixed(2)}x
            </span>
          ))}
        </div>
      )}

      <div className="crash-display">
        <div
          className="crash-rocket"
          style={{ bottom: phase === "running" ? `${rocketBottom}%` : "20%" }}
        >
          🚀
        </div>
        <div className={`crash-multiplier ${phase}`}>
          {phase === "betting"
            ? "Place your bets..."
            : phase === "cooldown"
              ? "Next round..."
              : `${multiplier.toFixed(2)}x`}
        </div>
      </div>

      {phase === "crashed" && crashState?.serverSeed && (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            marginTop: 8,
            fontFamily: "var(--font-mono)",
          }}
        >
          Crashed at {crashState.crashPoint.toFixed(2)}x — Provably fair seed
          revealed
        </p>
      )}

      <div className="bet-controls" style={{ marginTop: 24 }}>
        <div className="input-group">
          <label>Bet Amount (SOL) — Balance: {formatSol(balanceSol)}</label>
          <input
            className="input"
            type="number"
            step="0.001"
            min={minBetSol}
            max={maxBetSol}
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            disabled={phase !== "betting" || hasActiveBet}
          />
        </div>

        <div className="bet-amount-presets">
          {["0.01", "0.05", "0.1", "0.5"].map((preset) => (
            <button
              key={preset}
              className="preset-btn"
              onClick={() => setBetAmount(preset)}
              disabled={phase !== "betting" || hasActiveBet}
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="input-group">
          <label>Auto Cashout (optional, e.g. 2.00)</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="1.01"
            placeholder="2.00"
            value={autoCashout}
            onChange={(e) => setAutoCashout(e.target.value)}
            disabled={phase !== "betting" || hasActiveBet}
          />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            className="btn btn-primary"
            onClick={handleBet}
            disabled={loading || phase !== "betting" || hasActiveBet}
            style={{ flex: 1 }}
          >
            {hasActiveBet ? "Bet Placed" : "Place Bet"}
          </button>

          <button
            className="btn btn-success"
            onClick={handleCashout}
            disabled={loading || phase !== "running" || !hasActiveBet}
            style={{ flex: 1 }}
          >
            Cash Out {phase === "running" ? `@ ${multiplier.toFixed(2)}x` : ""}
          </button>
        </div>

        {message && (
          <div
            className={`alert ${message.includes("success") || message.includes("placed") || message.includes("Cashed") ? "alert-success" : "alert-error"}`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
