import {
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { PUMP_SDK } from "@pump-fun/pump-sdk";
import { refreshTransactionBlockhash } from "./solana";

export const PUMP_PROGRAM_ID =
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

export interface CreatePumpTokenParams {
  name: string;
  symbol: string;
  uri: string;
  creator: string;
}

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

export function getPumpFunUrl(mint: string): string {
  return `https://pump.fun/coin/${mint}`;
}
