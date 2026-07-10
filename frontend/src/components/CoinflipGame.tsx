import { useState, useEffect } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  confirmCoinflip,
  fetchCoinflipRecent,
  fetchUser,
  formatSol,
  playCoinflip,
  prepareCoinflip,
  revealCoinflip,
} from "../lib/api";
import { useCasino } from "../hooks/CasinoUserProvider";
import { useToast } from "./ui/Toast";
import { useSound } from "../hooks/useSound";
import { prepareTransaction, solscanTxUrl } from "../lib/utils";
import { PageHeader } from "./PageHeader";
import { BetAmountControls } from "./BetAmountControls";
import { RecentResultsStrip } from "./RecentResultsStrip";
import { SoundToggle } from "./SoundToggle";
import { WinCelebration } from "./WinCelebration";
import { GameActionSpinner } from "./GameActionSpinner";
import { Coin3D } from "./coinflip/Coin3D";
import { fairnessUrl } from "../lib/fairnessLink";
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

interface FlipRecord {
  id: string;
  result: "heads" | "tails";
  won: boolean;
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
  const { muted, toggleMute, play } = useSound();
  const [betAmount, setBetAmount] = useState("0.01");
  const [choice, setChoice] = useState<"heads" | "tails">("heads");
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<{
    flipResult: "heads" | "tails";
    won: boolean;
  } | null>(null);
  const [recentFlips, setRecentFlips] = useState<FlipRecord[]>([]);
  const [celebrateWin, setCelebrateWin] = useState(false);
  const [lastFairness, setLastFairness] = useState<{
    betId: string;
    serverSeed: string;
    clientSeed: string;
  } | null>(null);
  const onChain = config?.onChainEnabled ?? false;

  useEffect(() => {
    fetchCoinflipRecent()
      .then((rows) => {
        if (rows.length === 0) return;
        setRecentFlips(
          rows.map((r) => ({
            id: r.id,
            result: r.result,
            won: r.won,
          })),
        );
      })
      .catch(() => {
        /* optional strip — ignore load errors */
      });
  }, []);

  const handleFlip = async () => {
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < minBetSol || amount > maxBetSol) {
      toast(`Bet must be between ${minBetSol} and ${maxBetSol} SOL`, "error");
      return;
    }

    setFlipping(true);
    setResult(null);
    play("flip");

    try {
      if (onChain) {
        await ensurePlayerInitialized(walletAddress, signAndSendTx);
        const prepared = await prepareCoinflip(walletAddress);
        const revealed = await revealCoinflip(walletAddress, prepared.prepareId);
        const tx = await buildCoinflipBetTransaction(
          walletAddress,
          Math.floor(amount * LAMPORTS_PER_SOL),
          choice,
          revealed.clientSeed,
          revealed.serverSeed,
          revealed.serverSeedHash,
        );
        await prepareTransaction(walletAddress, tx);
        const { signature } = await signAndSendTx(tx);

        const flipResult = await confirmCoinflip({
          walletAddress,
          amountSol: amount,
          choice,
          clientSeed: revealed.clientSeed,
          serverSeed: revealed.serverSeed,
          signature,
        });

        await new Promise((r) => setTimeout(r, 1200));
        setResult({ flipResult: flipResult.result, won: flipResult.won });
        setRecentFlips((prev) =>
          [
            {
              id: signature,
              result: flipResult.result,
              won: flipResult.won,
            },
            ...prev,
          ].slice(0, 10),
        );
        play(flipResult.won ? "win" : "limboBust");
        if (flipResult.won) setCelebrateWin(true);
        setLastFairness({
          betId: signature,
          serverSeed: revealed.serverSeed,
          clientSeed: revealed.clientSeed,
        });
        await refresh();
        const updated = await fetchUser(walletAddress);
        onBalanceUpdate(updated.balanceSol);

        toast(
          flipResult.won
            ? `You won! Result: ${flipResult.result}`
            : `Lost — it was ${flipResult.result}`,
          flipResult.won ? "success" : "info",
          { label: "View tx", href: solscanTxUrl(signature) },
        );
      } else {
        const flipResult = await playCoinflip(walletAddress, amount, choice);
        await new Promise((r) => setTimeout(r, 1200));
        setResult({ flipResult: flipResult.result, won: flipResult.won });
        setRecentFlips((prev) =>
          [
            {
              id: `${Date.now()}`,
              result: flipResult.result,
              won: flipResult.won,
            },
            ...prev,
          ].slice(0, 10),
        );
        play(flipResult.won ? "win" : "limboBust");
        if (flipResult.won) setCelebrateWin(true);
        setLastFairness({
          betId: flipResult.betId,
          serverSeed: flipResult.serverSeed,
          clientSeed: flipResult.clientSeed,
        });
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
      <div className="game-header-row">
        <PageHeader
          title="Coinflip"
          subtitle="50/50 instant flips · commit-reveal fairness"
          badge={
            onChain ? (
              <span className="on-chain-badge">
                <span className="on-chain-dot" />
                On-Chain
              </span>
            ) : undefined
          }
        />
        <SoundToggle muted={muted} onToggle={toggleMute} />
      </div>

      <RecentResultsStrip
        title="Recent"
        results={recentFlips.map((f) => ({
          id: f.id,
          label: f.result === "heads" ? "H" : "T",
          variant: f.won ? "win" : "loss",
        }))}
      />

      <div className="coinflip-container">
        <div className="game-action-stage">
          <WinCelebration active={celebrateWin} onDone={() => setCelebrateWin(false)} />
          <Coin3D
            flipping={flipping}
            result={result?.flipResult ?? null}
            won={result?.won ?? null}
          />
        </div>

        <div className="choice-buttons">
          <button
            type="button"
            className={`choice-btn ${choice === "heads" ? "selected" : ""}`}
            onClick={() => setChoice("heads")}
            disabled={flipping}
          >
            Heads
          </button>
          <button
            type="button"
            className={`choice-btn ${choice === "tails" ? "selected" : ""}`}
            onClick={() => setChoice("tails")}
            disabled={flipping}
          >
            Tails
          </button>
        </div>

        <BetAmountControls
          balanceSol={balanceSol}
          minBetSol={minBetSol}
          maxBetSol={maxBetSol}
          amount={betAmount}
          onAmountChange={setBetAmount}
          disabled={flipping}
        />

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleFlip}
          disabled={flipping}
          style={{ width: "100%", maxWidth: 320 }}
        >
          {flipping ? <GameActionSpinner label="Flipping..." /> : `Flip for ${betAmount} SOL`}
        </button>

        {lastFairness && (
          <a className="fairness-link" href={fairnessUrl({
            game: "coinflip",
            betId: lastFairness.betId,
            serverSeed: lastFairness.serverSeed,
            clientSeed: lastFairness.clientSeed,
          })}>
            Verify last flip in Fairness tab
          </a>
        )}

        {onChain && (
          <p className="coinflip-fairness-note">
            Commit-reveal seeds verified on-chain via Anchor program
          </p>
        )}
      </div>
    </div>
  );
}
