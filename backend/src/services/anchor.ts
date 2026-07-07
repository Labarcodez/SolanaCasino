import { AnchorProvider, BN, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import bs58 from "bs58";
import idl from "../idl/solcasino.json" with { type: "json" };
import { config } from "../config.js";
import {
  getBetPda,
  getCasinoPda,
  getPlayerPda,
  getRoundPda,
  getVaultPda,
  PROGRAM_ID,
  seedHexToBytes32,
} from "./pdas.js";

let authorityKeypair: Keypair | null = null;

function loadAuthorityKeypair(): Keypair | null {
  if (authorityKeypair) return authorityKeypair;
  const secret =
    config.programAuthorityPrivateKey || config.casinoWalletPrivateKey;
  if (!secret) return null;
  try {
    authorityKeypair = Keypair.fromSecretKey(bs58.decode(secret));
    return authorityKeypair;
  } catch {
    return null;
  }
}

export function isAnchorEnabled(): boolean {
  return Boolean(loadAuthorityKeypair());
}

export function getConnection(): Connection {
  return new Connection(config.solanaRpcUrl, "confirmed");
}

export function getProgram(): Program<Idl> | null {
  const kp = loadAuthorityKeypair();
  if (!kp) return null;
  const connection = getConnection();
  const wallet = new Wallet(kp);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program(idl as Idl, provider);
}

export async function fetchPlayerAccount(walletAddress: string) {
  const connection = getConnection();
  const owner = new PublicKey(walletAddress);
  const [playerPda] = getPlayerPda(owner);
  const program = getProgram();
  if (!program) return null;

  try {
    const player = await (program.account as Record<string, { fetch: (pk: PublicKey) => Promise<unknown> }>).player.fetch(playerPda);
    const data = player as {
      balance: { toNumber?: () => number } | number;
      totalWagered: { toNumber?: () => number } | number;
      totalWon: { toNumber?: () => number } | number;
    };
    const toNum = (v: { toNumber?: () => number } | number) =>
      typeof v === "number" ? v : (v.toNumber?.() ?? 0);

    return {
      address: playerPda.toBase58(),
      balanceLamports: toNum(data.balance),
      totalWageredLamports: toNum(data.totalWagered),
      totalWonLamports: toNum(data.totalWon),
    };
  } catch {
    return null;
  }
}

export async function fetchCasinoAccount() {
  const program = getProgram();
  if (!program) return null;
  const [casinoPda] = getCasinoPda();
  try {
    const casino = await (program.account as Record<string, { fetch: (pk: PublicKey) => Promise<unknown> }>).casino.fetch(casinoPda);
    const data = casino as {
      authority: PublicKey;
      roundCounter: { toNumber?: () => number } | number;
      minBet: { toNumber?: () => number } | number;
      maxBet: { toNumber?: () => number } | number;
      houseEdgeBps: number;
      isPaused: boolean;
    };
    const toNum = (v: { toNumber?: () => number } | number) =>
      typeof v === "number" ? v : (v.toNumber?.() ?? 0);

    return {
      address: casinoPda.toBase58(),
      authority: data.authority.toBase58(),
      roundCounter: toNum(data.roundCounter),
      minBetLamports: toNum(data.minBet),
      maxBetLamports: toNum(data.maxBet),
      houseEdgeBps: Number(data.houseEdgeBps),
      isPaused: Boolean(data.isPaused),
    };
  } catch {
    return null;
  }
}

export async function initializeCasinoIfNeeded(): Promise<string | null> {
  const program = getProgram();
  if (!program) return null;

  const existing = await fetchCasinoAccount();
  if (existing) return existing.address;

  const [casinoPda] = getCasinoPda();
  const [vaultPda] = getVaultPda();

  const sig = await program.methods
    .initializeCasino()
    .accounts({
      casino: casinoPda,
      vault: vaultPda,
      authority: program.provider.publicKey!,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return sig;
}

export async function startRoundOnChain(
  roundId: number,
  serverSeedHashHex: string,
): Promise<string | null> {
  const program = getProgram();
  if (!program) return null;

  const [casinoPda] = getCasinoPda();
  const [roundPda] = getRoundPda(roundId);
  const seedHash = seedHexToBytes32(serverSeedHashHex);

  return program.methods
    .startRound(new BN(roundId), seedHash)
    .accounts({
      casino: casinoPda,
      round: roundPda,
      authority: program.provider.publicKey!,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function startRunningOnChain(roundId: number): Promise<string | null> {
  const program = getProgram();
  if (!program) return null;

  const [casinoPda] = getCasinoPda();
  const [roundPda] = getRoundPda(roundId);

  return program.methods
    .startRunning()
    .accounts({
      casino: casinoPda,
      round: roundPda,
      authority: program.provider.publicKey!,
    })
    .rpc();
}

export async function finalizeRoundOnChain(
  roundId: number,
  serverSeedHex: string,
): Promise<string | null> {
  const program = getProgram();
  if (!program) return null;

  const [casinoPda] = getCasinoPda();
  const [roundPda] = getRoundPda(roundId);
  const seedBytes = seedHexToBytes32(serverSeedHex);

  return program.methods
    .finalizeRound(seedBytes)
    .accounts({
      casino: casinoPda,
      round: roundPda,
      authority: program.provider.publicKey!,
    })
    .rpc();
}

export async function settleBetOnChain(
  roundId: number,
  playerWallet: string,
): Promise<string | null> {
  const program = getProgram();
  if (!program) return null;

  const owner = new PublicKey(playerWallet);
  const [roundPda] = getRoundPda(roundId);
  const [playerPda] = getPlayerPda(owner);
  const [betPda] = getBetPda(roundPda, owner);

  return program.methods
    .settleBet()
    .accounts({
      round: roundPda,
      bet: betPda,
      player: playerPda,
    })
    .rpc();
}

export async function authorityCashoutOnChain(
  roundId: number,
  playerWallet: string,
): Promise<string | null> {
  const program = getProgram();
  if (!program) return null;

  const owner = new PublicKey(playerWallet);
  const [casinoPda] = getCasinoPda();
  const [roundPda] = getRoundPda(roundId);
  const [betPda] = getBetPda(roundPda, owner);

  return program.methods
    .authorityCashout()
    .accounts({
      casino: casinoPda,
      round: roundPda,
      bet: betPda,
      authority: program.provider.publicKey!,
    })
    .rpc();
}

export async function setPausedOnChain(paused: boolean): Promise<string | null> {
  const program = getProgram();
  if (!program) return null;

  const [casinoPda] = getCasinoPda();

  return program.methods
    .setPaused(paused)
    .accounts({
      casino: casinoPda,
      authority: program.provider.publicKey!,
    })
    .rpc();
}

export async function creditPlayerOnChain(
  playerWallet: string,
  amountLamports: number,
): Promise<string | null> {
  const program = getProgram();
  if (!program) return null;

  const owner = new PublicKey(playerWallet);
  const [casinoPda] = getCasinoPda();
  const [playerPda] = getPlayerPda(owner);

  return program.methods
    .creditPlayer(new BN(amountLamports))
    .accounts({
      casino: casinoPda,
      player: playerPda,
      authority: program.provider.publicKey!,
    })
    .rpc();
}

export function getPdaAddresses() {
  const [casinoPda, casinoBump] = getCasinoPda();
  const [vaultPda, vaultBump] = getVaultPda();
  return {
    programId: PROGRAM_ID.toBase58(),
    casinoPda: casinoPda.toBase58(),
    casinoBump,
    vaultPda: vaultPda.toBase58(),
    vaultBump,
  };
}
