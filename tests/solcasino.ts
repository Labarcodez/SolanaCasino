import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import idl from "../target/idl/solcasino.json" with { type: "json" };

describe("solcasino", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(idl as anchor.Idl, provider);
  const authority = (provider.wallet as anchor.Wallet).payer;

  const [casinoPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("casino")],
    program.programId,
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    program.programId,
  );

  it("initializes casino", async () => {
    try {
      await program.methods
        .initializeCasino()
        .accounts({
          casino: casinoPda,
          vault: vaultPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      // Already initialized is acceptable in repeated runs
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).to.match(/already in use|custom program error/i);
    }

    const casino = await program.account.casino.fetch(casinoPda);
    expect(casino.authority.toBase58()).to.equal(authority.publicKey.toBase58());
  });

  it("initializes player and deposits", async () => {
    const playerKp = Keypair.generate();
    await provider.connection.requestAirdrop(
      playerKp.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL,
    );
    await new Promise((r) => setTimeout(r, 1000));

    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), playerKp.publicKey.toBuffer()],
      program.programId,
    );

    await program.methods
      .initPlayer()
      .accounts({
        player: playerPda,
        owner: playerKp.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([playerKp])
      .rpc();

    const depositLamports = new anchor.BN(10_000_000);
    await program.methods
      .deposit(depositLamports)
      .accounts({
        casino: casinoPda,
        player: playerPda,
        vault: vaultPda,
        owner: playerKp.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([playerKp])
      .rpc();

    const player = await program.account.player.fetch(playerPda);
    expect(player.balance.toNumber()).to.equal(10_000_000);
  });
});
