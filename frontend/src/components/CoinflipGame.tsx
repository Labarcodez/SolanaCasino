import { useState } from "react";
import {
  confirmCoinflip,
  fetchUser,
  formatSol,
  playCoinflip,
  prepareCoinflip,
} from "../lib/api";
import { useCasino } from "../hooks/CasinoUserProvider";
import {
  buildCoinflipBetTransaction,
  ensurePlayerInitialized,
} from "../lib/anchor";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SOLANA_RPC } from "../lib/api";

interface CoinflipGameProps {
  walletAddress: string;
  balanceSol: number;
  minBetSol: number;
  maxBetSol: number;
  onBalanceUpdate: (balance: number) => void;
}

async function prepareTx(
  walletAddress: string,
  tx: Transaction,
): Promise<Transaction> {
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = new PublicKey(walletAddress);
  return tx;
}

export function CoinflipGame({
  walletAddress,
  balanceSol,
  minBetSol,
  maxBetSol,
  onBalanceUpdate,
}: CoinflipGameProps) {
  const { config, signAndSendTx, refresh } = useCasino();
  const [betAmount, setBetAmount] = useState("0.01");
  const [choice, setChoice] = useState<"heads" | "tails">("heads");
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<{
    flipResult: "heads" | "tails";
    won: boolean;
    payoutSol: number;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const onChain = config?.onChainEnabled ?? false;

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
      if (onChain) {
        await ensurePlayerInitialized(walletAddress, signAndSendTx);
        const prepared = await prepareCoinflip(walletAddress);
        const tx = await buildCoinflipBetTransaction(
          walletAddress,
          Math.floor(amount * LAMPORTS_PER_SOL),
          choice,
          prepared.clientSeed,
          prepared.serverSeed,
          prepared.serverSeedHash,
        );
        await prepareTx(walletAddress, tx);
        const { signature } = await signAndSendTx(tx);

        const flipResult = await confirmCoinflip({
          walletAddress,
          amountSol: amount,
          choice,
          clientSeed: prepared.clientSeed,
          serverSeed: prepared.serverSeed,
          signature,
        });

        await new Promise((r) => setTimeout(r, 600));
        const won = flipResult.won;
        setResult({
          flipResult: flipResult.result,
          won,
          payoutSol: won ? amount * 2 * (1 - (config?.houseEdge ?? 0.05)) : 0,
        });
        await refresh();
        const updated = await fetchUser(walletAddress);
        onBalanceUpdate(updated.balanceSol);
        setMessage(
          won
            ? `You won! It was ${flipResult.result}.`
            : `You lost. It was ${flipResult.result}.`,
        );
      } else {
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
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Flip failed");
    } finally {
      setFlipping(false);
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">
        🪙 Coinflip {onChain ? "(On-Chain)" : ""}
      </h3>

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

        <button
          className="btn btn-primary"
          onClick={handleFlip}
          disabled={flipping}
          style={{ width: "100%" }}
        >
          {flipping ? "Flipping..." : `Flip for ${betAmount} SOL`}
        </button>

        {message && (
          <div
            className={`alert ${message.includes("won") ? "alert-success" : "alert-error"}`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
