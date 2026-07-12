import { EventEmitter } from "node:events";
import { v4 as uuidv4 } from "uuid";
import { db, deductBalanceIfSufficient, runDbTask, updateBalance } from "../db/index.js";
import { recordBetWithRewards } from "./limbo.js";
import {
  generateCrashPoint,
  generateOnChainCrashPoint,
  generateServerSeed,
  hashServerSeed,
  hashServerSeedBytes,
} from "./provablyFair.js";
import { config, lamportsToSol, solToLamports } from "../config.js";
import {
  finalizeRoundOnChain,
  isAnchorEnabled,
  startRoundOnChain,
  startRunningOnChain,
} from "./anchor.js";
import {
  getJackpotState,
  recordJackpotContribution,
  tryAwardJackpot,
} from "./jackpot.js";

export type CrashPhase = "betting" | "running" | "crashed" | "cooldown";

export interface CrashBet {
  id: string;
  walletAddress: string;
  slot: 0 | 1;
  amountLamports: number;
  autoCashout?: number;
  cashedOut: boolean;
  cashoutMultiplier?: number;
  payoutLamports: number;
}

export const MAX_CRASH_BETS_PER_PLAYER = 2;

export interface CrashRoundState {
  id: string;
  phase: CrashPhase;
  serverSeedHash: string;
  serverSeed?: string;
  crashPoint: number;
  multiplier: number;
  bets: CrashBet[];
  startedAt: number;
  runningStartedAt?: number;
  elapsedMs: number;
  history: { roundId: string; crashPoint: number }[];
  onChainEnabled: boolean;
  bettingEndsAt: number;
}

const BETTING_DURATION_MS = 8000;
const COOLDOWN_DURATION_MS = 3000;
const TICK_MS = 50;
/** Bustabit-style e^(r·t) — ~2× in 9s, ~100× in ~58s (was linear 0.06×/s → 40min for 144×). */
const CRASH_GROWTH_RATE = 0.00008;

function multiplierAtElapsedMs(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs);
  return Math.min(Math.exp(CRASH_GROWTH_RATE * t), 1000);
}

function isLegacyPausedSync(): boolean {
  const row = db
    .prepare("SELECT value FROM app_meta WHERE key = 'casino_paused'")
    .get() as { value: string } | undefined;
  return row?.value === "true";
}

export class CrashGameEngine extends EventEmitter {
  private round: CrashRoundState;
  private serverSeed = "";
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private phaseTimeout: ReturnType<typeof setTimeout> | null = null;
  private startTime = 0;
  private history: { roundId: string; crashPoint: number }[] = [];
  private roundCounter = 0;
  private onChain = isAnchorEnabled();

  constructor() {
    super();
    this.round = this.createNewRound();
    this.loadHistory();
    void this.bootstrapOnChain();
    this.startBettingPhase();
  }

  private async bootstrapOnChain(): Promise<void> {
    if (!this.onChain) return;
    try {
      const { fetchCasinoAccount } = await import("./anchor.js");
      const casino = await fetchCasinoAccount();
      if (casino) {
        this.roundCounter = casino.roundCounter;
      }
    } catch (err) {
      console.warn("Anchor bootstrap skipped:", err);
    }
  }

  private loadHistory(): void {
    const rows = db
      .prepare(
        "SELECT id, crash_point FROM crash_rounds WHERE status = 'complete' ORDER BY started_at DESC LIMIT 10",
      )
      .all() as { id: string; crash_point: number }[];

    this.history = rows.map((r) => ({
      roundId: r.id,
      crashPoint: r.crash_point,
    }));
  }

  private createNewRound(): CrashRoundState {
    this.serverSeed = generateServerSeed();
    const nextId = this.onChain
      ? String(this.roundCounter + 1)
      : uuidv4();
    const serverSeedHash = this.onChain
      ? hashServerSeedBytes(this.serverSeed)
      : hashServerSeed(this.serverSeed);
    let crashPoint = this.onChain
      ? generateOnChainCrashPoint(this.serverSeed, Number(nextId))
      : generateCrashPoint(this.serverSeed, nextId, []);

    const testMaxCrash = parseFloat(process.env.CRASH_TEST_MAX_CRASH ?? "");
    if (
      !Number.isNaN(testMaxCrash) &&
      testMaxCrash >= 1 &&
      crashPoint > testMaxCrash
    ) {
      crashPoint = testMaxCrash;
    }

    runDbTask(() => {
      db.prepare(
        "INSERT INTO crash_rounds (id, server_seed_hash, crash_point, status) VALUES (?, ?, ?, 'betting')",
      ).run(nextId, serverSeedHash, crashPoint);
    });

    return {
      id: nextId,
      phase: "betting",
      serverSeedHash,
      crashPoint,
      multiplier: 1.0,
      bets: [],
      startedAt: Date.now(),
      elapsedMs: 0,
      history: [...this.history],
      onChainEnabled: this.onChain,
      bettingEndsAt: Date.now() + BETTING_DURATION_MS,
    };
  }

  getState(): CrashRoundState {
    const revealCrashPoint =
      this.round.phase === "crashed" || this.round.phase === "cooldown";
    return {
      ...this.round,
      crashPoint: revealCrashPoint ? this.round.crashPoint : 0,
      bets: this.round.bets.map((b) => ({
        ...b,
        walletAddress:
          b.walletAddress.slice(0, 4) + "..." + b.walletAddress.slice(-4),
      })),
      serverSeed: this.round.phase === "crashed" ? this.serverSeed : undefined,
      history: this.history,
      onChainEnabled: this.onChain,
    };
  }

  getFullStateForWallet(walletAddress: string): CrashRoundState & {
    myBets: CrashBet[];
  } {
    const myBets = this.round.bets.filter(
      (b) => b.walletAddress === walletAddress,
    );
    return { ...this.getState(), myBets };
  }

  placeBet(
    walletAddress: string,
    amountLamports: number,
    autoCashout?: number,
    slot: 0 | 1 = 0,
  ): CrashBet {
    if (isLegacyPausedSync()) {
      throw new Error("Casino is paused");
    }

    if (this.round.phase !== "betting") {
      throw new Error("Betting is closed for this round");
    }

    if (
      amountLamports < solToLamports(config.minBetSol) ||
      amountLamports > solToLamports(config.maxBetSol)
    ) {
      throw new Error(
        `Bet must be between ${config.minBetSol} and ${config.maxBetSol} SOL`,
      );
    }

    const balanceAfterDeduct = deductBalanceIfSufficient(
      walletAddress,
      amountLamports,
    );
    if (balanceAfterDeduct === null) {
      throw new Error("Insufficient balance");
    }

    if (slot !== 0 && slot !== 1) {
      throw new Error("Invalid bet slot");
    }

    const activeBets = this.round.bets.filter(
      (b) => b.walletAddress === walletAddress && !b.cashedOut,
    );
    if (activeBets.length >= MAX_CRASH_BETS_PER_PLAYER) {
      throw new Error("Maximum two bets per round");
    }
    const slotTaken = activeBets.some((b) => b.slot === slot);
    if (slotTaken) {
      throw new Error(`Bet ${slot === 0 ? "A" : "B"} already placed this round`);
    }

    const bet: CrashBet = {
      id: uuidv4(),
      walletAddress,
      slot,
      amountLamports,
      autoCashout,
      cashedOut: false,
      payoutLamports: 0,
    };

    this.round.bets.push(bet);
    recordJackpotContribution(bet.id, this.round.id, walletAddress, amountLamports);
    this.emit("jackpot_update", getJackpotState());
    this.emit("bet_placed", bet);
    return bet;
  }

  cashout(walletAddress: string, slot: 0 | 1 = 0): CrashBet {
    if (this.round.phase !== "running") {
      throw new Error("Can only cash out during active round");
    }

    const bet = this.round.bets.find(
      (b) =>
        b.walletAddress === walletAddress && !b.cashedOut && b.slot === slot,
    );
    if (!bet) {
      throw new Error(`No active bet in slot ${slot === 0 ? "A" : "B"}`);
    }

    return this.processCashout(bet, this.round.multiplier);
  }

  private processCashout(bet: CrashBet, multiplier: number): CrashBet {
    bet.cashedOut = true;
    bet.cashoutMultiplier = multiplier;
    bet.payoutLamports = Math.floor(bet.amountLamports * multiplier);

    updateBalance(bet.walletAddress, bet.payoutLamports);

    recordBetWithRewards({
      id: bet.id,
      walletAddress: bet.walletAddress,
      game: "crash",
      amountLamports: bet.amountLamports,
      payoutLamports: bet.payoutLamports,
      multiplier,
      result: "win",
      metadata: {
        roundId: this.round.id,
        cashoutMultiplier: multiplier,
        serverSeedHash: this.round.serverSeedHash,
      },
    });

    this.emit("cashout", { bet, multiplier });
    return bet;
  }

  private startBettingPhase(): void {
    this.clearTimers();
    this.round = this.createNewRound();
    this.round.phase = "betting";
    this.round.history = [...this.history];

    if (this.onChain) {
      const roundId = Number(this.round.id);
      void startRoundOnChain(roundId, this.round.serverSeedHash).catch((err) => {
        console.error("start_round on-chain failed:", err);
      });
    }

    this.emit("round_start", this.getState());

    this.phaseTimeout = setTimeout(() => {
      void this.startRunningPhase();
    }, BETTING_DURATION_MS);
  }

  private async startRunningPhase(): Promise<void> {
    this.round.phase = "running";
    this.round.multiplier = 1.0;
    this.round.elapsedMs = 0;
    this.startTime = Date.now();
    this.round.runningStartedAt = this.startTime;

    if (this.onChain) {
      try {
        await startRunningOnChain(Number(this.round.id));
      } catch (err) {
        console.error("start_running on-chain failed:", err);
      }
    }

    this.emit("round_running", this.getState());

    this.tickInterval = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        console.error("Crash tick failed:", err);
        this.clearTimers();
        this.emit("engine_error", err);
        try {
          this.startBettingPhase();
        } catch (restartErr) {
          console.error("Crash engine restart failed:", restartErr);
        }
      }
    }, TICK_MS);
  }

  private tick(): void {
    const elapsed = Date.now() - this.startTime;
    this.round.elapsedMs = elapsed;
    this.round.multiplier = multiplierAtElapsedMs(elapsed);

    for (const bet of this.round.bets) {
      if (
        !bet.cashedOut &&
        bet.autoCashout &&
        this.round.multiplier >= bet.autoCashout
      ) {
        this.processCashout(bet, bet.autoCashout);
      }
    }

    if (this.round.multiplier >= this.round.crashPoint) {
      void this.crash();
      return;
    }

    this.emit("tick", {
      multiplier: this.round.multiplier,
      elapsedMs: elapsed,
    });
  }

  private async crash(): Promise<void> {
    this.clearTimers();
    this.round.phase = "crashed";
    this.round.multiplier = this.round.crashPoint;

    if (this.onChain) {
      try {
        await finalizeRoundOnChain(Number(this.round.id), this.serverSeed);
        this.roundCounter = Number(this.round.id);
      } catch (err) {
        console.error("finalize_round on-chain failed:", err);
      }
    } else {
      for (const bet of this.round.bets) {
        if (!bet.cashedOut) {
          recordBetWithRewards({
            id: bet.id,
            walletAddress: bet.walletAddress,
            game: "crash",
            amountLamports: bet.amountLamports,
            payoutLamports: 0,
            multiplier: this.round.crashPoint,
            result: "loss",
            metadata: {
              roundId: this.round.id,
              crashPoint: this.round.crashPoint,
              serverSeedHash: this.round.serverSeedHash,
            },
          });
        }
      }
    }

    runDbTask(() => {
      db.prepare(
        "UPDATE crash_rounds SET status = 'complete', server_seed = ?, ended_at = datetime('now') WHERE id = ?",
      ).run(this.serverSeed, this.round.id);
    });

    this.history.unshift({
      roundId: this.round.id,
      crashPoint: this.round.crashPoint,
    });
    if (this.history.length > 10) this.history.pop();

    const jackpotAward = await tryAwardJackpot(
      this.round.id,
      this.round.crashPoint,
      this.round.bets,
    );
    if (jackpotAward) {
      this.emit("jackpot_won", {
        ...jackpotAward,
        walletAddress:
          jackpotAward.walletAddress.slice(0, 4) +
          "..." +
          jackpotAward.walletAddress.slice(-4),
        amountSol: lamportsToSol(jackpotAward.amountLamports),
      });
    }
    this.emit("jackpot_update", getJackpotState());

    this.emit("crash", {
      crashPoint: this.round.crashPoint,
      serverSeed: this.serverSeed,
      serverSeedHash: this.round.serverSeedHash,
      roundId: this.round.id,
      onChainEnabled: this.onChain,
    });

    this.round.phase = "cooldown";
    this.phaseTimeout = setTimeout(() => {
      this.startBettingPhase();
    }, COOLDOWN_DURATION_MS);
  }

  private clearTimers(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.phaseTimeout) {
      clearTimeout(this.phaseTimeout);
      this.phaseTimeout = null;
    }
  }

  destroy(): void {
    this.clearTimers();
  }
}

export const crashEngine = new CrashGameEngine();
