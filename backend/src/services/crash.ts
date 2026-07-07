import { EventEmitter } from "node:events";
import { v4 as uuidv4 } from "uuid";
import { db, updateBalance } from "../db/index.js";
import { recordBetWithRewards } from "./limbo.js";
import {
  generateCrashPoint,
  generateOnChainCrashPoint,
  generateServerSeed,
  hashServerSeed,
  hashServerSeedBytes,
} from "./provablyFair.js";
import { config } from "../config.js";
import {
  finalizeRoundOnChain,
  isAnchorEnabled,
  startRoundOnChain,
  startRunningOnChain,
} from "./anchor.js";

export type CrashPhase = "betting" | "running" | "crashed" | "cooldown";

export interface CrashBet {
  id: string;
  walletAddress: string;
  amountLamports: number;
  autoCashout?: number;
  cashedOut: boolean;
  cashoutMultiplier?: number;
  payoutLamports: number;
}

export interface CrashRoundState {
  id: string;
  phase: CrashPhase;
  serverSeedHash: string;
  serverSeed?: string;
  crashPoint: number;
  multiplier: number;
  bets: CrashBet[];
  startedAt: number;
  elapsedMs: number;
  history: { roundId: string; crashPoint: number }[];
  onChainEnabled: boolean;
  bettingEndsAt: number;
}

const BETTING_DURATION_MS = 8000;
const COOLDOWN_DURATION_MS = 3000;
const TICK_MS = 50;
const GROWTH_RATE_MILLI = 60;

function multiplierAtElapsedMs(elapsedMs: number): number {
  const growth = 1000 + (GROWTH_RATE_MILLI * elapsedMs) / 1000;
  return Math.min(growth / 1000, 1000);
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
        "SELECT id, crash_point FROM crash_rounds WHERE status = 'complete' ORDER BY started_at DESC LIMIT 20",
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
    const crashPoint = this.onChain
      ? generateOnChainCrashPoint(this.serverSeed, Number(nextId))
      : generateCrashPoint(this.serverSeed, nextId, []);

    db.prepare(
      "INSERT INTO crash_rounds (id, server_seed_hash, crash_point, status) VALUES (?, ?, ?, 'betting')",
    ).run(nextId, serverSeedHash, crashPoint);

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
    return {
      ...this.round,
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
  ): CrashBet {
    if (this.onChain) {
      throw new Error("Place bets on-chain via your wallet");
    }

    if (this.round.phase !== "betting") {
      throw new Error("Betting is closed for this round");
    }

    const user = db
      .prepare("SELECT balance_lamports FROM users WHERE wallet_address = ?")
      .get(walletAddress) as { balance_lamports: number } | undefined;

    if (!user || user.balance_lamports < amountLamports) {
      throw new Error("Insufficient balance");
    }

    const existing = this.round.bets.find(
      (b) => b.walletAddress === walletAddress && !b.cashedOut,
    );
    if (existing) {
      throw new Error("You already have an active bet this round");
    }

    updateBalance(walletAddress, -amountLamports);

    const bet: CrashBet = {
      id: uuidv4(),
      walletAddress,
      amountLamports,
      autoCashout,
      cashedOut: false,
      payoutLamports: 0,
    };

    this.round.bets.push(bet);
    this.emit("bet_placed", bet);
    return bet;
  }

  cashout(walletAddress: string): CrashBet {
    if (this.onChain) {
      throw new Error("Cash out on-chain via your wallet");
    }

    if (this.round.phase !== "running") {
      throw new Error("Can only cash out during active round");
    }

    const bet = this.round.bets.find(
      (b) => b.walletAddress === walletAddress && !b.cashedOut,
    );
    if (!bet) {
      throw new Error("No active bet to cash out");
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
    this.startTime = Date.now();

    if (this.onChain) {
      try {
        await startRunningOnChain(Number(this.round.id));
      } catch (err) {
        console.error("start_running on-chain failed:", err);
      }
    }

    this.emit("round_running", this.getState());

    this.tickInterval = setInterval(() => {
      this.tick();
    }, TICK_MS);
  }

  private tick(): void {
    const elapsed = Date.now() - this.startTime;
    this.round.elapsedMs = elapsed;
    this.round.multiplier = this.onChain
      ? multiplierAtElapsedMs(elapsed)
      : Math.floor(Math.pow(Math.E, 0.00006 * elapsed) * 100) / 100;

    if (!this.onChain) {
      for (const bet of this.round.bets) {
        if (
          !bet.cashedOut &&
          bet.autoCashout &&
          this.round.multiplier >= bet.autoCashout
        ) {
          this.processCashout(bet, bet.autoCashout);
        }
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

    db.prepare(
      "UPDATE crash_rounds SET status = 'complete', server_seed = ?, ended_at = datetime('now') WHERE id = ?",
    ).run(this.serverSeed, this.round.id);

    this.history.unshift({
      roundId: this.round.id,
      crashPoint: this.round.crashPoint,
    });
    if (this.history.length > 20) this.history.pop();

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
