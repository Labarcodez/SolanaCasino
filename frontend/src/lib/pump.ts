import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  Connection,
} from "@solana/web3.js";
import {
  OnlinePumpSdk,
  PUMP_SDK,
  bondingCurveMarketCap,
} from "@pump-fun/pump-sdk";
import { refreshTransactionBlockhash } from "./solana";
import { getSolanaRpc } from "./cluster";
import type {
  CreatePumpTokenParams,
  PumpBondingCurveStats,
  PumpTokenMetadata,
} from "./pumpTypes";

export type { CreatePumpTokenParams, PumpBondingCurveStats, PumpTokenMetadata };
export { PUMP_PROGRAM_ID, getPumpFunUrl } from "./pumpUrl";

/** Pump.fun bonding curves typically graduate near ~85 SOL raised. */
const GRADUATION_TARGET_SOL = 85;

export async function buildPumpCreateTransaction(
  params: CreatePumpTokenParams,
): Promise<{ transaction: Transaction; mint: Keypair }> {
  const mint = Keypair.generate();
  const creator = new PublicKey(params.creator);

  const createIx = await PUMP_SDK.createV2Instruction({
    mint: mint.publicKey,
    name: params.name,
    symbol: params.symbol.toUpperCase(),
    uri: params.uri,
    creator,
    user: creator,
    mayhemMode: false,
    cashback: false,
  });

  const tx = new Transaction().add(createIx);
  await refreshTransactionBlockhash(tx, params.creator);
  tx.partialSign(mint);

  return { transaction: tx, mint };
}

export async function fetchPumpBondingCurveStats(
  mint: string,
): Promise<PumpBondingCurveStats> {
  const connection = new Connection(getSolanaRpc(), "confirmed");
  const sdk = new OnlinePumpSdk(connection);
  const mintPk = new PublicKey(mint);

  try {
    const bondingCurve = await sdk.fetchBondingCurve(mintPk);
    const marketCapLamports = bondingCurveMarketCap({
      mintSupply: bondingCurve.tokenTotalSupply,
      virtualQuoteReserves: bondingCurve.virtualQuoteReserves,
      virtualTokenReserves: bondingCurve.virtualTokenReserves,
    });
    const realSol =
      bondingCurve.realQuoteReserves.toNumber() / LAMPORTS_PER_SOL;
    const progressPercent = bondingCurve.complete
      ? 100
      : Math.min(100, (realSol / GRADUATION_TARGET_SOL) * 100);

    return {
      progressPercent,
      marketCapSol: marketCapLamports.toNumber() / LAMPORTS_PER_SOL,
      realSolReserves: realSol,
      isGraduated: bondingCurve.complete,
      exists: true,
    };
  } catch {
    return {
      progressPercent: 0,
      marketCapSol: 0,
      realSolReserves: 0,
      isGraduated: false,
      exists: false,
    };
  }
}

export async function fetchPumpTokenMetadata(
  mint: string,
): Promise<PumpTokenMetadata | null> {
  try {
    const res = await fetch(
      `https://frontend-api.pump.fun/coins/${mint}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      name?: string;
      symbol?: string;
      image_uri?: string;
      description?: string;
    };
    return {
      name: data.name,
      symbol: data.symbol,
      image: data.image_uri,
      description: data.description,
    };
  } catch {
    return null;
  }
}
