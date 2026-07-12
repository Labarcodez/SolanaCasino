import { PublicKey } from "@solana/web3.js";
import {
  authorityCashoutOnChain,
  getConnection,
  isAnchorEnabled,
  settleBetOnChain,
} from "./anchor.js";
import { crashEngine } from "./crash.js";
import { getBetPda, getRoundPda } from "./pdas.js";

/** Must match backend `crash.ts` / frontend `crashCurve.ts`. */
const CRASH_GROWTH_RATE = 0.00008;

interface TrackedBet {
  walletAddress: string;
  roundId: number;
  autoCashoutMilli: number;
  cashedOut: boolean;
  settled: boolean;
}

function multiplierAtElapsedMs(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs);
  return Math.min(
    Math.floor(Math.exp(CRASH_GROWTH_RATE * t) * 1000),
    1_000_000, // milli units (= 1000.000×)
  );
}

const trackedBets = new Map<string, TrackedBet>();

function betKey(roundId: number, wallet: string): string {
  return `${roundId}:${wallet}`;
}

export function registerOnChainCrashBet(params: {
  roundId: number;
  walletAddress: string;
  autoCashoutMultiplier?: number;
}): void {
  if (!isAnchorEnabled()) return;

  const autoCashoutMilli = params.autoCashoutMultiplier
    ? Math.floor(params.autoCashoutMultiplier * 1000)
    : 0;

  trackedBets.set(betKey(params.roundId, params.walletAddress), {
    walletAddress: params.walletAddress,
    roundId: params.roundId,
    autoCashoutMilli,
    cashedOut: false,
    settled: false,
  });
}

async function processAutoCashouts(
  roundId: number,
  currentMultiplierMilli: number,
): Promise<void> {
  for (const [key, bet] of trackedBets) {
    if (bet.roundId !== roundId || bet.cashedOut || bet.settled) continue;
    if (
      bet.autoCashoutMilli > 0 &&
      currentMultiplierMilli >= bet.autoCashoutMilli
    ) {
      try {
        await authorityCashoutOnChain(roundId, bet.walletAddress);
        bet.cashedOut = true;
        trackedBets.set(key, bet);
      } catch (err) {
        console.error(
          `Auto-cashout failed for ${bet.walletAddress} round ${roundId}:`,
          err,
        );
      }
    }
  }
}

async function settleRoundBets(roundId: number): Promise<void> {
  for (const [key, bet] of trackedBets) {
    if (bet.roundId !== roundId || bet.settled) continue;
    try {
      await settleBetOnChain(roundId, bet.walletAddress);
      bet.settled = true;
      trackedBets.set(key, bet);
    } catch (err) {
      console.error(
        `Settle bet failed for ${bet.walletAddress} round ${roundId}:`,
        err,
      );
    }
  }
}

let keeperInterval: ReturnType<typeof setInterval> | null = null;
let runningRoundId: number | null = null;
let runningSince = 0;

export function startCrashKeeper(): void {
  if (!isAnchorEnabled() || keeperInterval) return;

  crashEngine.on("round_running", (state) => {
    runningRoundId = Number(state.id);
    runningSince = Date.now();
  });

  crashEngine.on("tick", ({ elapsedMs }) => {
    if (runningRoundId === null) return;
    const multiplierMilli = multiplierAtElapsedMs(elapsedMs);
    void processAutoCashouts(runningRoundId, multiplierMilli);
  });

  crashEngine.on("crash", async (data) => {
    const roundId = Number(data.roundId);
    runningRoundId = null;
    await settleRoundBets(roundId);

    for (const key of [...trackedBets.keys()]) {
      if (trackedBets.get(key)?.roundId === roundId) {
        trackedBets.delete(key);
      }
    }
  });

  keeperInterval = setInterval(() => {
    if (runningRoundId === null || runningSince === 0) return;
    const elapsedMs = Date.now() - runningSince;
    const multiplierMilli = multiplierAtElapsedMs(elapsedMs);
    void processAutoCashouts(runningRoundId, multiplierMilli);
  }, 100);

  console.log("Crash keeper started (on-chain auto-cashout + settle)");
}

export async function fetchOnChainBet(
  roundId: number,
  walletAddress: string,
): Promise<{
  amount: number;
  autoCashoutMilli: number;
  cashedOut: boolean;
  cashoutMultiplierMilli: number;
  settled: boolean;
} | null> {
  if (!isAnchorEnabled()) return null;

  const program = await import("./anchor.js").then((m) => m.getProgram());
  if (!program) return null;

  const owner = new PublicKey(walletAddress);
  const [roundPda] = getRoundPda(roundId);
  const [betPda] = getBetPda(roundPda, owner);

  try {
    const bet = await (
      program.account as Record<
        string,
        { fetch: (pk: PublicKey) => Promise<unknown> }
      >
    ).bet.fetch(betPda);
    const data = bet as {
      amount: { toNumber?: () => number } | number;
      autoCashoutMultiplierMilli: { toNumber?: () => number } | number;
      cashedOut: boolean;
      cashoutMultiplierMilli: { toNumber?: () => number } | number;
      settled: boolean;
    };
    const toNum = (v: { toNumber?: () => number } | number) =>
      typeof v === "number" ? v : (v.toNumber?.() ?? 0);

    return {
      amount: toNum(data.amount),
      autoCashoutMilli: toNum(data.autoCashoutMultiplierMilli),
      cashedOut: data.cashedOut,
      cashoutMultiplierMilli: toNum(data.cashoutMultiplierMilli),
      settled: data.settled,
    };
  } catch {
    return null;
  }
}
