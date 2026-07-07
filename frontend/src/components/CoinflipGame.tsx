import { useState } from "react";
import { motion } from "framer-motion";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  confirmCoinflip,
  fetchUser,
  formatSol,
  playCoinflip,
  prepareCoinflip,
} from "../lib/api";
import { useCasino } from "../hooks/CasinoUserProvider";
import { useToast } from "./ui/Toast";
import { prepareTransaction } from "../lib/utils";
import { PageHeader } from "./PageHeader";
import {
  buildCoinflipBetTransaction,
  ensurePlayerInitialized,
} from "../lib/anchor";

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
  const { config, signAndSendTx, refresh } = useCasino();
  const { toast } = useToast();
  const [betAmount, setBetAmount] = useState("0.01");
  const [choice, setChoice] = useState<"heads" | "tails">("heads");
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<{
    flipResult: "heads" | "tails";
    won: boolean;
  } | null>(null);
  const onChain = config?.onChainEnabled ?? false;

  const handleFlip = async () => {
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < minBetSol || amount > maxBetSol) {
      toast(`Bet must be between ${minBetSol} and ${maxBetSol} SOL`, "error");
      return;
    }

    setFlipping(true);
    setResult(null);

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
        await prepareTransaction(walletAddress, tx);
        const { signature } = await signAndSendTx(tx);

        const flipResult = await confirmCoinflip({
          walletAddress,
          amountSol: amount,
          choice,
          clientSeed: prepared.clientSeed,
          serverSeed: prepared.serverSeed,
          signature,
        });

        await new Promise((r) => setTimeout(r, 800));
        setResult({ flipResult: flipResult.result, won: flipResult.won });
        await refresh();
        const updated = await fetchUser(walletAddress);
        onBalanceUpdate(updated.balanceSol);

        toast(
          flipResult.won
            ? `You won! Result: ${flipResult.result}`
            : `Lost — it was ${flipResult.result}`,
          flipResult.won ? "success" : "info",
          { label: "View tx", href: `https://solscan.io/tx/${signature}?cluster=devnet` },
        );
      } else {
        const flipResult = await playCoinflip(walletAddress, amount, choice);
        await new Promise((r) => setTimeout(r, 800));
        setResult({ flipResult: flipResult.result, won: flipResult.won });
        onBalanceUpdate(flipResult.balanceSol);
        toast(
          flipResult.won
            ? `Won ${formatSol(flipResult.payoutSol)} SOL!`
            : `Lost — ${flipResult.result}`,
          flipResult.won ? "success" : "info",
        );
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Flip failed", "error");
    } finally {
      setFlipping(false);
    }
  };

  return (
    <div className="card card-glow">
      <PageHeader
        title="Coinflip"
        subtitle="50/50 instant flips · commit-reveal fairness"
        badge={onChain ? <span className="on-chain-badge"><span className="on-chain-dot" />On-Chain</span> : undefined}
      />

      <div className="coinflip-container">
        <motion.div
          className={`coin ${flipping ? "flipping" : ""} ${
            result
              ? result.flipResult === "heads"
                ? "coin-heads"
                : "coin-tails"
              : ""
          }`}
          animate={flipping ? { rotateY: 360 } : {}}
          transition={{ duration: 0.8 }}
        >
          {result ? (result.flipResult === "heads" ? "👑" : "🦅") : "◎"}
        </motion.div>

        <div className="choice-buttons">
          <button
            type="button"
            className={`choice-btn ${choice === "heads" ? "selected" : ""}`}
            onClick={() => setChoice("heads")}
            disabled={flipping}
          >
            👑 Heads
          </button>
          <button
            type="button"
            className={`choice-btn ${choice === "tails" ? "selected" : ""}`}
            onClick={() => setChoice("tails")}
            disabled={flipping}
          >
            🦅 Tails
          </button>
        </div>

        <div className="input-group" style={{ width: "100%", maxWidth: 320 }}>
          <label>Amount — {formatSol(balanceSol)} SOL available</label>
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
          {["0.01", "0.05", "0.1"].map((p) => (
            <button
              key={p}
              type="button"
              className="preset-btn"
              onClick={() => setBetAmount(p)}
              disabled={flipping}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleFlip}
          disabled={flipping}
          style={{ width: "100%", maxWidth: 320 }}
        >
          {flipping ? "Flipping..." : `Flip for ${betAmount} SOL`}
        </button>

        {onChain && (
          <p className="coinflip-fairness-note">
            Commit-reveal seeds verified on-chain via Anchor program
          </p>
        )}
      </div>
    </div>
  );
}
