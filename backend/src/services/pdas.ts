import { PublicKey } from "@solana/web3.js";
import { config } from "../config.js";

export const PROGRAM_ID = new PublicKey(config.programId);

export function getCasinoPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("casino")], PROGRAM_ID);
}

export function getVaultPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID);
}

export function getPlayerPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("player"), owner.toBuffer()],
    PROGRAM_ID,
  );
}

export function getRoundPda(roundId: number | bigint): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(roundId));
  return PublicKey.findProgramAddressSync([Buffer.from("round"), buf], PROGRAM_ID);
}

export function getBetPda(round: PublicKey, owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), round.toBuffer(), owner.toBuffer()],
    PROGRAM_ID,
  );
}

export function hexToBytes32(hex: string): number[] {
  const normalized = hex.length === 64 ? hex : Buffer.from(hex, "utf8").toString("hex").slice(0, 64);
  const bytes: number[] = [];
  for (let i = 0; i < 64; i += 2) {
    bytes.push(parseInt(normalized.slice(i, i + 2), 16));
  }
  return bytes;
}

export function seedHexToBytes32(seedHex: string): number[] {
  return hexToBytes32(seedHex.padEnd(64, "0").slice(0, 64));
}
