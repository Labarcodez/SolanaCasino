import { useCallback, useEffect, useState } from "react";
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
import { ConnectTrigger } from "./ConnectTrigger";
import { Coin3D } from "./coinflip/Coin3D";
import { fairnessUrl } from "../lib/fairnessLink";
import { hapticPulse } from "../lib/haptics";

interface CoinflipGameProps {
  walletAddress?: string;
  balanceSol: number;
  minBetSol: number;
  maxBetSol: number;
  onBalanceUpdate: (balance: number) => void;
  spectator?: boolean;
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
  spectator = false,
}: CoinflipGameProps) {
  const { toast } = useToast();
  const { muted, volume, toggleMute, setVolume, play } = useSound();
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

  const handleFlip = useCallback(async () => {
    if (spectator || !walletAddress) return;
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
      if (flipResult.won) {
        setCelebrateWin(true);
        hapticPulse(16);
      } else {
        hapticPulse(28);
      }
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
  }, [
    spectator,
    walletAddress,
    betAmount,
    minBetSol,
    maxBetSol,
    choice,
    toast,
    play,
    onBalanceUpdate,
  ]);

  useEffect(() => {
    if (spectator) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "h" || e.key === "H") {
        setChoice("heads");
        return;
      }
      if (e.key === "t" || e.key === "T") {
        setChoice("tails");
        return;
      }
      if (e.code === "Enter" && !flipping) {
        e.preventDefault();
        void handleFlip();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [spectator, flipping, handleFlip]);

  return (
    <div className="card card-glow">
      <div className="game-header-row">
        <PageHeader
          title="Coinflip"
          subtitle="50/50 instant flips · 1.95× payout · commit-reveal fairness"
        />
        <button
          type="button"
          className="btn btn-outline btn-sm fairness-trigger"
          onClick={() => setFairnessOpen(true)}
          data-testid="coinflip-fairness-button"
        >
          Fairness
        </button>
        <SoundToggle
          muted={muted}
          volume={volume}
          onToggle={toggleMute}
          onVolumeChange={setVolume}
        />
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
        <div className="game-action-stage" aria-live="polite" aria-atomic="true">
          <WinCelebration active={celebrateWin} onDone={() => setCelebrateWin(false)} />
          <Coin3D
            flipping={flipping}
            result={result?.flipResult ?? null}
            won={result?.won ?? null}
          />
          {result && !flipping && (
            <p className="coinflip-result-sr">
              {result.won ? "You won" : "You lost"} — {result.flipResult}
            </p>
          )}
        </div>

        <div className="choice-buttons">
          <button
            type="button"
            className={`choice-btn ${choice === "heads" ? "selected" : ""}`}
            onClick={() => setChoice("heads")}
            disabled={flipping || spectator}
          >
            Heads
          </button>
          <button
            type="button"
            className={`choice-btn ${choice === "tails" ? "selected" : ""}`}
            onClick={() => setChoice("tails")}
            disabled={flipping || spectator}
          >
            Tails
          </button>
        </div>

        <p className="coinflip-payout-preview text-muted">
          Win pays <strong>1.95×</strong> your bet (5% house edge)
        </p>

        <BetAmountControls
          balanceSol={balanceSol}
          minBetSol={minBetSol}
          maxBetSol={maxBetSol}
          amount={betAmount}
          onAmountChange={setBetAmount}
          disabled={flipping || spectator}
        />

        {spectator ? (
          <ConnectTrigger intent="play" label="Connect to play" fullWidth testId="coinflip-spectator-connect" />
        ) : (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleFlip()}
          disabled={flipping}
          style={{ width: "100%", maxWidth: 320 }}
        >
          {flipping ? <GameActionSpinner label="Flipping..." /> : `Flip for ${betAmount} SOL`}
        </button>
        )}

        {!spectator && (
          <p className="game-shortcut-hint text-muted">
            H = heads · T = tails · Enter = flip
          </p>
        )}

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
