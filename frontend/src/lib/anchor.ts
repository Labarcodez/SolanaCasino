import { AnchorProvider, BN, Idl, Program } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import idl from "../idl/solcasino.json";
import { PROGRAM_ID, SOLANA_RPC } from "./api";

export function getConnection(): Connection {
  return new Connection(SOLANA_RPC, "confirmed");
}

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

export function getRoundPda(roundId: number): [PublicKey, number] {
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

function hexToBytes32(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < 64; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

function clientSeedToBytes16(hex: string): number[] {
  const bytes: number[] = [];
  const normalized = hex.padEnd(32, "0").slice(0, 32);
  for (let i = 0; i < 32; i += 2) {
    bytes.push(parseInt(normalized.slice(i, i + 2), 16));
  }
  return bytes.slice(0, 16);
}

export function createReadOnlyProgram(connection: Connection): Program<Idl> {
  const provider = new AnchorProvider(
    connection,
    {
      publicKey: PublicKey.default,
      signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) => tx,
      signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]) => txs,
    },
    { commitment: "confirmed" },
  );
  return new Program(idl as Idl, provider);
}

export async function fetchPlayerBalance(
  walletAddress: string,
): Promise<{ balanceLamports: number; initialized: boolean }> {
  const connection = getConnection();
  const owner = new PublicKey(walletAddress);
  const [playerPda] = getPlayerPda(owner);
  const program = createReadOnlyProgram(connection);

  try {
    const player = await (program.account as Record<string, { fetch: (pk: PublicKey) => Promise<{ balance: { toNumber: () => number } }> }>).player.fetch(playerPda);
    return {
      balanceLamports: Number(player.balance),
      initialized: true,
    };
  } catch {
    return { balanceLamports: 0, initialized: false };
  }
}

export async function buildInitPlayerTransaction(
  walletAddress: string,
): Promise<Transaction> {
  const connection = getConnection();
  const program = createReadOnlyProgram(connection);
  const owner = new PublicKey(walletAddress);
  const [playerPda] = getPlayerPda(owner);

  return program.methods
    .initPlayer()
    .accounts({
      player: playerPda,
      owner,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export async function buildDepositTransaction(
  walletAddress: string,
  amountLamports: number,
): Promise<Transaction> {
  const connection = getConnection();
  const program = createReadOnlyProgram(connection);
  const owner = new PublicKey(walletAddress);
  const [casinoPda] = getCasinoPda();
  const [playerPda] = getPlayerPda(owner);
  const [vaultPda] = getVaultPda();

  return program.methods
    .deposit(new BN(amountLamports))
    .accounts({
      casino: casinoPda,
      player: playerPda,
      vault: vaultPda,
      owner,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export async function buildWithdrawTransaction(
  walletAddress: string,
  amountLamports: number,
): Promise<Transaction> {
  const connection = getConnection();
  const program = createReadOnlyProgram(connection);
  const owner = new PublicKey(walletAddress);
  const [casinoPda] = getCasinoPda();
  const [playerPda] = getPlayerPda(owner);
  const [vaultPda] = getVaultPda();

  return program.methods
    .withdraw(new BN(amountLamports))
    .accounts({
      casino: casinoPda,
      player: playerPda,
      vault: vaultPda,
      owner,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export async function buildPlaceBetTransaction(
  walletAddress: string,
  roundId: number,
  amountLamports: number,
  autoCashoutMultiplier?: number,
): Promise<Transaction> {
  const connection = getConnection();
  const program = createReadOnlyProgram(connection);
  const owner = new PublicKey(walletAddress);
  const [casinoPda] = getCasinoPda();
  const [playerPda] = getPlayerPda(owner);
  const [roundPda] = getRoundPda(roundId);
  const [betPda] = getBetPda(roundPda, owner);

  const autoCashoutMilli =
    autoCashoutMultiplier && autoCashoutMultiplier >= 1.01
      ? Math.floor(autoCashoutMultiplier * 1000)
      : 0;

  return program.methods
    .placeBet(new BN(amountLamports), new BN(autoCashoutMilli))
    .accounts({
      casino: casinoPda,
      player: playerPda,
      round: roundPda,
      bet: betPda,
      owner,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export async function buildCashoutTransaction(
  walletAddress: string,
  roundId: number,
): Promise<Transaction> {
  const connection = getConnection();
  const program = createReadOnlyProgram(connection);
  const owner = new PublicKey(walletAddress);
  const [roundPda] = getRoundPda(roundId);
  const [betPda] = getBetPda(roundPda, owner);

  return program.methods
    .cashout()
    .accounts({
      round: roundPda,
      bet: betPda,
      owner,
    })
    .transaction();
}

export async function buildSettleBetTransaction(
  walletAddress: string,
  roundId: number,
): Promise<Transaction> {
  const connection = getConnection();
  const program = createReadOnlyProgram(connection);
  const owner = new PublicKey(walletAddress);
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
    .transaction();
}

export async function buildCoinflipBetTransaction(
  walletAddress: string,
  amountLamports: number,
  choice: "heads" | "tails",
  clientSeedHex: string,
  serverSeedHex: string,
  serverSeedHashHex: string,
): Promise<Transaction> {
  const connection = getConnection();
  const program = createReadOnlyProgram(connection);
  const owner = new PublicKey(walletAddress);
  const [casinoPda] = getCasinoPda();
  const [playerPda] = getPlayerPda(owner);

  return program.methods
    .coinflipBet(
      new BN(amountLamports),
      choice === "heads" ? 0 : 1,
      clientSeedToBytes16(clientSeedHex),
      hexToBytes32(serverSeedHashHex),
      hexToBytes32(serverSeedHex),
    )
    .accounts({
      casino: casinoPda,
      player: playerPda,
      owner,
    })
    .transaction();
}

export async function buildLimboBetTransaction(
  walletAddress: string,
  amountLamports: number,
  targetMultiplier: number,
  clientSeedHex: string,
  serverSeedHex: string,
  serverSeedHashHex: string,
): Promise<Transaction> {
  const connection = getConnection();
  const program = createReadOnlyProgram(connection);
  const owner = new PublicKey(walletAddress);
  const [casinoPda] = getCasinoPda();
  const [playerPda] = getPlayerPda(owner);
  const targetMilli = Math.floor(targetMultiplier * 1000);

  return program.methods
    .limboBet(
      new BN(amountLamports),
      new BN(targetMilli),
      clientSeedToBytes16(clientSeedHex),
      hexToBytes32(serverSeedHashHex),
      hexToBytes32(serverSeedHex),
    )
    .accounts({
      casino: casinoPda,
      player: playerPda,
      owner,
    })
    .transaction();
}

export async function ensurePlayerInitialized(
  walletAddress: string,
  signAndSend: (tx: Transaction) => Promise<{ signature: string }>,
): Promise<void> {
  const { initialized } = await fetchPlayerBalance(walletAddress);
  if (initialized) return;

  const connection = getConnection();
  const tx = await buildInitPlayerTransaction(walletAddress);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = new PublicKey(walletAddress);

  const { signature } = await signAndSend(tx);
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
}
