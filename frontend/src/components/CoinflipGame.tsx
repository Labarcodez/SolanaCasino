import { useState } from "react";
import { playCoinflip } from "../lib/api";
import { formatSol } from "../lib/api";

interface CoinflipGameProps {
  walletAddress: string;
  balanceSol: number;
  minBetSol: number;
  maxBetSol: number;
  onBalanceUpdate: (balance: number) => void;
}

export function CoinflipGame({
  walletAddress,
  balanceSol,
  minBetSol,
  maxBetSol,
  onBalanceUpdate,
}: CoinflipGameProps) {
  const [betAmount, setBetAmount] = useState("0.01");
  const [choice, setChoice] = useState<"heads" | "tails">("heads");
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<{
    flipResult: "heads" | "tails";
    won: boolean;
    payoutSol: number;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleFlip = async () => {
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < minBetSol || amount > maxBetSol) {
      setMessage(`Bet must be between ${minBetSol} and ${maxBetSol} SOL`);
      return;
    }

    setFlipping(true);
    setResult(null);
    setMessage(null);

    try {
      const flipResult = await playCoinflip(walletAddress, amount, choice);
      await new Promise((r) => setTimeout(r, 600));
      setResult({
        flipResult: flipResult.result,
        won: flipResult.won,
        payoutSol: flipResult.payoutSol,
      });
      onBalanceUpdate(flipResult.balanceSol);
      setMessage(
        flipResult.won
          ? `You won ${formatSol(flipResult.payoutSol)} SOL!`
          : `You lost. It was ${flipResult.result}.`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Flip failed");
    } finally {
      setFlipping(false);
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">🪙 Coinflip</h3>

      <div className="coinflip-container">
        <div className={`coin ${flipping ? "flipping" : ""}`}>
          {result ? (result.flipResult === "heads" ? "👑" : "🦅") : "🪙"}
        </div>

        <div className="choice-buttons">
          <button
            className={`choice-btn ${choice === "heads" ? "selected" : ""}`}
            onClick={() => setChoice("heads")}
            disabled={flipping}
          >
            👑 Heads
          </button>
          <button
            className={`choice-btn ${choice === "tails" ? "selected" : ""}`}
            onClick={() => setChoice("tails")}
            disabled={flipping}
          >
            🦅 Tails
          </button>
        </div>

        <div className="bet-controls" style={{ width: "100%", maxWidth: 400 }}>
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
              disabled={flipping}
            />
          </div>

          <div className="bet-amount-presets">
            {["0.01", "0.05", "0.1", "0.5"].map((preset) => (
              <button
                key={preset}
                className="preset-btn"
                onClick={() => setBetAmount(preset)}
                disabled={flipping}
              >
                {preset}
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={handleFlip}
            disabled={flipping}
            style={{ width: "100%" }}
          >
            {flipping ? "Flipping..." : `Flip — ${betAmount} SOL on ${choice}`}
          </button>

          {message && (
            <div
              className={`alert ${result?.won ? "alert-success" : result ? "alert-error" : "alert-error"}`}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
