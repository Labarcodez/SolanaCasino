import { useState, useEffect } from "react";
import {
  fetchCoinflipRecent,
  formatSol,
  playCoinflip,
} from "../lib/api";
import { useToast } from "./ui/Toast";
import { useSound } from "../hooks/useSound";
import { PageHeader } from "./PageHeader";
import { BetAmountControls } from "./BetAmountControls";
import { RecentResultsStrip } from "./RecentResultsStrip";
import { SoundToggle } from "./SoundToggle";
import { WinCelebration } from "./WinCelebration";
import { FairnessModal } from "./FairnessModal";
import { GameActionSpinner } from "./GameActionSpinner";
import { Coin3D } from "./coinflip/Coin3D";
import { fairnessUrl } from "../lib/fairnessLink";

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
  const [fairnessOpen, setFairnessOpen] = useState(false);

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
      const flipResult = await playCoinflip(walletAddress, amount, choice);
      await new Promise((r) => setTimeout(r, 1200));
      setResult({ flipResult: flipResult.result, won: flipResult.won });
      setRecentFlips((prev) =>
        [
          {
            id: flipResult.betId,
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
        />
        <button
          type="button"
          className="btn btn-outline btn-sm fairness-trigger"
          onClick={() => setFairnessOpen(true)}
          data-testid="coinflip-fairness-button"
        >
          Fairness
        </button>
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

      </div>

      <FairnessModal
        open={fairnessOpen}
        onClose={() => setFairnessOpen(false)}
        initialGame="coinflip"
      />
    </div>
  );
}
