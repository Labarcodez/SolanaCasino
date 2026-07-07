import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { CASINO_WALLET, SOLANA_RPC } from "./api";

export async function buildDepositTransaction(
  fromAddress: string,
  amountSol: number,
): Promise<VersionedTransaction> {
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const { blockhash } = await connection.getLatestBlockhash();

  const message = new TransactionMessage({
    payerKey: new PublicKey(fromAddress),
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: new PublicKey(fromAddress),
        toPubkey: new PublicKey(CASINO_WALLET),
        lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
