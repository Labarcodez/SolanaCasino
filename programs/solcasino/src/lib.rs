use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use solana_sha256_hasher::hashv;

declare_id!("Be5brMe2AvA68zEdiFKxa6KfYJdeQAeY12eWtZiC41vU");

pub const HOUSE_EDGE_BPS: u16 = 500; // 5%
pub const LIMBO_HOUSE_EDGE_BPS: u16 = 200; // 2% — 98% RTP volume game
pub const DEFAULT_MIN_BET: u64 = 1_000_000; // 0.001 SOL
pub const DEFAULT_MAX_BET: u64 = 10_000_000_000; // 10 SOL
pub const GROWTH_RATE_MILLI: u64 = 60; // 0.00006 * 1_000_000

#[program]
pub mod solcasino {
    use super::*;

    pub fn initialize_casino(ctx: Context<InitializeCasino>) -> Result<()> {
        let casino = &mut ctx.accounts.casino;
        casino.authority = ctx.accounts.authority.key();
        casino.bump = ctx.bumps.casino;
        casino.vault_bump = ctx.bumps.vault;
        casino.house_edge_bps = HOUSE_EDGE_BPS;
        casino.min_bet = DEFAULT_MIN_BET;
        casino.max_bet = DEFAULT_MAX_BET;
        casino.round_counter = 0;
        casino.total_wagered = 0;
        casino.is_paused = false;
        msg!("Casino initialized");
        Ok(())
    }

    pub fn init_player(ctx: Context<InitPlayer>) -> Result<()> {
        let player = &mut ctx.accounts.player;
        player.owner = ctx.accounts.owner.key();
        player.balance = 0;
        player.total_wagered = 0;
        player.total_won = 0;
        player.bump = ctx.bumps.player;
        msg!("Player initialized");
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.casino.is_paused, CasinoError::CasinoPaused);
        require!(amount > 0, CasinoError::InvalidAmount);

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;

        ctx.accounts.player.balance = ctx
            .accounts
            .player
            .balance
            .checked_add(amount)
            .ok_or(CasinoError::MathOverflow)?;

        msg!("Deposited {} lamports", amount);
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.casino.is_paused, CasinoError::CasinoPaused);
        require!(amount > 0, CasinoError::InvalidAmount);
        require!(
            ctx.accounts.player.balance >= amount,
            CasinoError::InsufficientBalance
        );

        ctx.accounts.player.balance = ctx
            .accounts
            .player
            .balance
            .checked_sub(amount)
            .ok_or(CasinoError::MathOverflow)?;

        let seeds = &[b"vault".as_ref(), &[ctx.accounts.casino.vault_bump]];
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.owner.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;

        msg!("Withdrew {} lamports", amount);
        Ok(())
    }

    pub fn coinflip_bet(
        ctx: Context<Coinflip>,
        amount: u64,
        choice: u8,
        client_seed: [u8; 16],
        server_seed_hash: [u8; 32],
        server_seed: [u8; 32],
    ) -> Result<()> {
        require!(!ctx.accounts.casino.is_paused, CasinoError::CasinoPaused);
        require!(choice <= 1, CasinoError::InvalidChoice);
        validate_bet_amount(&ctx.accounts.casino, amount)?;
        require!(
            ctx.accounts.player.balance >= amount,
            CasinoError::InsufficientBalance
        );

        let computed_hash = sha256_bytes(&server_seed);
        require!(
            computed_hash == server_seed_hash,
            CasinoError::InvalidSeedReveal
        );

        let flip = generate_coinflip_result(&server_seed, &ctx.accounts.owner.key(), &client_seed);
        let player_wins = (flip == 0 && choice == 0) || (flip == 1 && choice == 1);

        ctx.accounts.player.balance = ctx
            .accounts
            .player
            .balance
            .checked_sub(amount)
            .ok_or(CasinoError::MathOverflow)?;
        ctx.accounts.player.total_wagered = ctx
            .accounts
            .player
            .total_wagered
            .checked_add(amount)
            .ok_or(CasinoError::MathOverflow)?;
        ctx.accounts.casino.total_wagered = ctx
            .accounts
            .casino
            .total_wagered
            .checked_add(amount)
            .ok_or(CasinoError::MathOverflow)?;

        if player_wins {
            let payout = apply_house_edge_double(amount, ctx.accounts.casino.house_edge_bps);
            ctx.accounts.player.balance = ctx
                .accounts
                .player
                .balance
                .checked_add(payout)
                .ok_or(CasinoError::MathOverflow)?;
            ctx.accounts.player.total_won = ctx
                .accounts
                .player
                .total_won
                .checked_add(payout)
                .ok_or(CasinoError::MathOverflow)?;
            msg!("Coinflip win! Payout: {}", payout);
        } else {
            msg!("Coinflip loss");
        }

        Ok(())
    }

    pub fn limbo_bet(
        ctx: Context<Limbo>,
        amount: u64,
        target_multiplier_milli: u64,
        client_seed: [u8; 16],
        server_seed_hash: [u8; 32],
        server_seed: [u8; 32],
    ) -> Result<()> {
        require!(!ctx.accounts.casino.is_paused, CasinoError::CasinoPaused);
        require!(
            target_multiplier_milli >= 1_010 && target_multiplier_milli <= 1_000_000,
            CasinoError::InvalidMultiplier
        );
        validate_bet_amount(&ctx.accounts.casino, amount)?;
        require!(
            ctx.accounts.player.balance >= amount,
            CasinoError::InsufficientBalance
        );

        let computed_hash = sha256_bytes(&server_seed);
        require!(
            computed_hash == server_seed_hash,
            CasinoError::InvalidSeedReveal
        );

        let roll = generate_limbo_roll(&server_seed, &ctx.accounts.owner.key(), &client_seed);
        let won = limbo_roll_wins(roll, target_multiplier_milli, LIMBO_HOUSE_EDGE_BPS);

        ctx.accounts.player.balance = ctx
            .accounts
            .player
            .balance
            .checked_sub(amount)
            .ok_or(CasinoError::MathOverflow)?;
        ctx.accounts.player.total_wagered = ctx
            .accounts
            .player
            .total_wagered
            .checked_add(amount)
            .ok_or(CasinoError::MathOverflow)?;
        ctx.accounts.casino.total_wagered = ctx
            .accounts
            .casino
            .total_wagered
            .checked_add(amount)
            .ok_or(CasinoError::MathOverflow)?;

        if won {
            let payout = amount
                .checked_mul(target_multiplier_milli)
                .ok_or(CasinoError::MathOverflow)?
                / 1000;
            ctx.accounts.player.balance = ctx
                .accounts
                .player
                .balance
                .checked_add(payout)
                .ok_or(CasinoError::MathOverflow)?;
            ctx.accounts.player.total_won = ctx
                .accounts
                .player
                .total_won
                .checked_add(payout)
                .ok_or(CasinoError::MathOverflow)?;
            msg!("Limbo win! {}x payout: {}", target_multiplier_milli, payout);
        } else {
            msg!("Limbo loss at roll {}", roll);
        }

        Ok(())
    }

    pub fn start_round(
        ctx: Context<StartRound>,
        round_id: u64,
        server_seed_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.casino.authority,
            CasinoError::Unauthorized
        );
        require!(
            round_id == ctx.accounts.casino.round_counter.checked_add(1).ok_or(CasinoError::MathOverflow)?,
            CasinoError::InvalidRoundId
        );

        let casino = &mut ctx.accounts.casino;
        casino.round_counter = round_id;

        let round = &mut ctx.accounts.round;
        round.id = round_id;
        round.server_seed_hash = server_seed_hash;
        round.server_seed = [0u8; 32];
        round.seed_revealed = false;
        round.crash_point_milli = 0;
        round.status = RoundStatus::Betting as u8;
        round.running_since = 0;
        round.bump = ctx.bumps.round;

        msg!("Round {} started", round.id);
        Ok(())
    }

    pub fn place_bet(ctx: Context<PlaceBet>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.casino.is_paused, CasinoError::CasinoPaused);
        validate_bet_amount(&ctx.accounts.casino, amount)?;
        require!(
            ctx.accounts.round.status == RoundStatus::Betting as u8,
            CasinoError::RoundNotBetting
        );
        require!(
            ctx.accounts.player.balance >= amount,
            CasinoError::InsufficientBalance
        );

        ctx.accounts.player.balance = ctx
            .accounts
            .player
            .balance
            .checked_sub(amount)
            .ok_or(CasinoError::MathOverflow)?;
        ctx.accounts.player.total_wagered = ctx
            .accounts
            .player
            .total_wagered
            .checked_add(amount)
            .ok_or(CasinoError::MathOverflow)?;
        ctx.accounts.casino.total_wagered = ctx
            .accounts
            .casino
            .total_wagered
            .checked_add(amount)
            .ok_or(CasinoError::MathOverflow)?;

        let bet = &mut ctx.accounts.bet;
        bet.round_id = ctx.accounts.round.id;
        bet.player = ctx.accounts.owner.key();
        bet.amount = amount;
        bet.cashed_out = false;
        bet.cashout_multiplier_milli = 0;
        bet.settled = false;
        bet.bump = ctx.bumps.bet;

        msg!("Bet placed: {} lamports on round {}", amount, bet.round_id);
        Ok(())
    }

    pub fn start_running(ctx: Context<StartRunning>) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.casino.authority,
            CasinoError::Unauthorized
        );
        require!(
            ctx.accounts.round.status == RoundStatus::Betting as u8,
            CasinoError::RoundNotBetting
        );

        let clock = Clock::get()?;
        ctx.accounts.round.status = RoundStatus::Running as u8;
        ctx.accounts.round.running_since = clock.unix_timestamp;
        msg!("Round {} running", ctx.accounts.round.id);
        Ok(())
    }

    pub fn cashout(ctx: Context<Cashout>) -> Result<()> {
        require!(
            ctx.accounts.round.status == RoundStatus::Running as u8,
            CasinoError::RoundNotRunning
        );
        require!(!ctx.accounts.bet.cashed_out, CasinoError::AlreadyCashedOut);
        require!(!ctx.accounts.bet.settled, CasinoError::BetAlreadySettled);

        let clock = Clock::get()?;
        let elapsed_ms = (clock.unix_timestamp - ctx.accounts.round.running_since)
            .max(0) as u64
            * 1000;
        let current_multiplier_milli = multiplier_at_elapsed(elapsed_ms);

        ctx.accounts.bet.cashed_out = true;
        ctx.accounts.bet.cashout_multiplier_milli = current_multiplier_milli;

        msg!(
            "Cashout recorded at {}x",
            current_multiplier_milli as f64 / 1000.0
        );
        Ok(())
    }

    pub fn finalize_round(ctx: Context<FinalizeRound>, server_seed: [u8; 32]) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.casino.authority,
            CasinoError::Unauthorized
        );
        require!(
            ctx.accounts.round.status == RoundStatus::Running as u8
                || ctx.accounts.round.status == RoundStatus::Betting as u8,
            CasinoError::RoundAlreadySettled
        );

        let computed_hash = sha256_bytes(&server_seed);
        require!(
            computed_hash == ctx.accounts.round.server_seed_hash,
            CasinoError::InvalidSeedReveal
        );

        let crash_point_milli = generate_crash_point_milli(&server_seed, ctx.accounts.round.id);

        ctx.accounts.round.server_seed = server_seed;
        ctx.accounts.round.seed_revealed = true;
        ctx.accounts.round.crash_point_milli = crash_point_milli;
        ctx.accounts.round.status = RoundStatus::Settled as u8;

        msg!(
            "Round {} finalized at {}x",
            ctx.accounts.round.id,
            crash_point_milli as f64 / 1000.0
        );
        Ok(())
    }

    pub fn settle_bet(ctx: Context<SettleBet>) -> Result<()> {
        require!(
            ctx.accounts.round.status == RoundStatus::Settled as u8,
            CasinoError::RoundNotSettled
        );
        require!(!ctx.accounts.bet.settled, CasinoError::BetAlreadySettled);
        require!(
            ctx.accounts.bet.amount > 0,
            CasinoError::InvalidAmount
        );

        let bet = &mut ctx.accounts.bet;
        bet.settled = true;

        if bet.cashed_out && bet.cashout_multiplier_milli <= ctx.accounts.round.crash_point_milli {
            let payout = bet
                .amount
                .checked_mul(bet.cashout_multiplier_milli)
                .ok_or(CasinoError::MathOverflow)?
                .checked_div(1000)
                .ok_or(CasinoError::MathOverflow)?;

            ctx.accounts.player.balance = ctx
                .accounts
                .player
                .balance
                .checked_add(payout)
                .ok_or(CasinoError::MathOverflow)?;
            ctx.accounts.player.total_won = ctx
                .accounts
                .player
                .total_won
                .checked_add(payout)
                .ok_or(CasinoError::MathOverflow)?;
            msg!("Bet won: {} lamports", payout);
        } else if !bet.cashed_out {
            msg!(
                "Bet lost at crash {}x",
                ctx.accounts.round.crash_point_milli as f64 / 1000.0
            );
        }

        Ok(())
    }
}

// ─── Accounts ───────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeCasino<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Casino::INIT_SPACE,
        seeds = [b"casino"],
        bump
    )]
    pub casino: Account<'info, Casino>,
    /// CHECK: Vault PDA holding SOL
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: SystemAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitPlayer<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Player::INIT_SPACE,
        seeds = [b"player", owner.key().as_ref()],
        bump
    )]
    pub player: Account<'info, Player>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(seeds = [b"casino"], bump = casino.bump)]
    pub casino: Account<'info, Casino>,
    #[account(
        mut,
        seeds = [b"player", owner.key().as_ref()],
        bump = player.bump,
        has_one = owner
    )]
    pub player: Account<'info, Player>,
    /// CHECK: vault
    #[account(mut, seeds = [b"vault"], bump = casino.vault_bump)]
    pub vault: SystemAccount<'info>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(seeds = [b"casino"], bump = casino.bump)]
    pub casino: Account<'info, Casino>,
    #[account(
        mut,
        seeds = [b"player", owner.key().as_ref()],
        bump = player.bump,
        has_one = owner
    )]
    pub player: Account<'info, Player>,
    /// CHECK: vault
    #[account(mut, seeds = [b"vault"], bump = casino.vault_bump)]
    pub vault: SystemAccount<'info>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Coinflip<'info> {
    #[account(mut, seeds = [b"casino"], bump = casino.bump)]
    pub casino: Account<'info, Casino>,
    #[account(
        mut,
        seeds = [b"player", owner.key().as_ref()],
        bump = player.bump,
        has_one = owner
    )]
    pub player: Account<'info, Player>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct Limbo<'info> {
    #[account(mut, seeds = [b"casino"], bump = casino.bump)]
    pub casino: Account<'info, Casino>,
    #[account(
        mut,
        seeds = [b"player", owner.key().as_ref()],
        bump = player.bump,
        has_one = owner
    )]
    pub player: Account<'info, Player>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct StartRound<'info> {
    #[account(mut, seeds = [b"casino"], bump = casino.bump)]
    pub casino: Account<'info, Casino>,
    #[account(
        init,
        payer = authority,
        space = 8 + Round::INIT_SPACE,
        seeds = [b"round", round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub round: Account<'info, Round>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut, seeds = [b"casino"], bump = casino.bump)]
    pub casino: Account<'info, Casino>,
    #[account(
        mut,
        seeds = [b"player", owner.key().as_ref()],
        bump = player.bump,
        has_one = owner
    )]
    pub player: Account<'info, Player>,
    #[account(
        mut,
        seeds = [b"round", round.id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,
    #[account(
        init,
        payer = owner,
        space = 8 + Bet::INIT_SPACE,
        seeds = [b"bet", round.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, Bet>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartRunning<'info> {
    #[account(seeds = [b"casino"], bump = casino.bump)]
    pub casino: Account<'info, Casino>,
    #[account(
        mut,
        seeds = [b"round", round.id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Cashout<'info> {
    #[account(
        seeds = [b"round", round.id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,
    #[account(
        mut,
        seeds = [b"bet", round.key().as_ref(), owner.key().as_ref()],
        bump = bet.bump,
        constraint = bet.player == owner.key() @ CasinoError::Unauthorized
    )]
    pub bet: Account<'info, Bet>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizeRound<'info> {
    #[account(seeds = [b"casino"], bump = casino.bump)]
    pub casino: Account<'info, Casino>,
    #[account(
        mut,
        seeds = [b"round", round.id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettleBet<'info> {
    #[account(
        seeds = [b"round", round.id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,
    #[account(
        mut,
        seeds = [b"bet", round.key().as_ref(), player.owner.as_ref()],
        bump = bet.bump,
        constraint = bet.player == player.owner @ CasinoError::Unauthorized
    )]
    pub bet: Account<'info, Bet>,
    #[account(
        mut,
        seeds = [b"player", player.owner.as_ref()],
        bump = player.bump
    )]
    pub player: Account<'info, Player>,
}

// ─── State ──────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct Casino {
    pub authority: Pubkey,
    pub bump: u8,
    pub vault_bump: u8,
    pub house_edge_bps: u16,
    pub min_bet: u64,
    pub max_bet: u64,
    pub round_counter: u64,
    pub total_wagered: u64,
    pub is_paused: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Player {
    pub owner: Pubkey,
    pub balance: u64,
    pub total_wagered: u64,
    pub total_won: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Round {
    pub id: u64,
    pub server_seed_hash: [u8; 32],
    pub server_seed: [u8; 32],
    pub seed_revealed: bool,
    pub crash_point_milli: u64,
    pub status: u8,
    pub running_since: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Bet {
    pub round_id: u64,
    pub player: Pubkey,
    pub amount: u64,
    pub cashed_out: bool,
    pub cashout_multiplier_milli: u64,
    pub settled: bool,
    pub bump: u8,
}

#[repr(u8)]
pub enum RoundStatus {
    Betting = 0,
    Running = 1,
    Settled = 2,
}

#[error_code]
pub enum CasinoError {
    #[msg("Casino is paused")]
    CasinoPaused,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid coinflip choice")]
    InvalidChoice,
    #[msg("Bet amount out of range")]
    BetOutOfRange,
    #[msg("Round is not in betting phase")]
    RoundNotBetting,
    #[msg("Round is not running")]
    RoundNotRunning,
    #[msg("Round already settled")]
    RoundAlreadySettled,
    #[msg("Round not finalized yet")]
    RoundNotSettled,
    #[msg("Invalid round id")]
    InvalidRoundId,
    #[msg("Already cashed out")]
    AlreadyCashedOut,
    #[msg("Bet already settled")]
    BetAlreadySettled,
    #[msg("Invalid seed reveal")]
    InvalidSeedReveal,
    #[msg("Invalid limbo target multiplier")]
    InvalidMultiplier,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

fn sha256_bytes(data: &[u8]) -> [u8; 32] {
    hashv(&[data]).to_bytes()
}

fn validate_bet_amount(casino: &Casino, amount: u64) -> Result<()> {
    require!(amount >= casino.min_bet, CasinoError::BetOutOfRange);
    require!(amount <= casino.max_bet, CasinoError::BetOutOfRange);
    Ok(())
}

fn apply_house_edge_double(amount: u64, house_edge_bps: u16) -> u64 {
    let multiplier = 20_000u64.saturating_sub(house_edge_bps as u64 * 2);
    amount.saturating_mul(multiplier) / 10_000
}

fn generate_coinflip_result(
    server_seed: &[u8; 32],
    owner: &Pubkey,
    client_seed: &[u8; 16],
) -> u8 {
    let mut data = Vec::with_capacity(64);
    data.extend_from_slice(server_seed);
    data.extend_from_slice(owner.as_ref());
    data.extend_from_slice(client_seed);
    let h = sha256_bytes(&data);
    u8::from(h[0]) % 2
}

fn generate_limbo_roll(
    server_seed: &[u8; 32],
    owner: &Pubkey,
    client_seed: &[u8; 16],
) -> u16 {
    let mut data = Vec::with_capacity(64);
    data.extend_from_slice(server_seed);
    data.extend_from_slice(owner.as_ref());
    data.extend_from_slice(client_seed);
    let h = sha256_bytes(&data);
    let val = u16::from(h[0]) << 8 | u16::from(h[1]);
    val % 10_000
}

fn limbo_roll_wins(roll: u16, target_multiplier_milli: u64, edge_bps: u16) -> bool {
    let win_chance_bps =
        (10_000u64.saturating_sub(edge_bps as u64)).saturating_mul(1000) / target_multiplier_milli;
    (roll as u64) < win_chance_bps
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn generate_crash_point_milli(server_seed: &[u8; 32], round_id: u64) -> u64 {
    let seed_hex = hex_encode(server_seed);
    let combined = format!("{}:{}", seed_hex, round_id);
    let hash_bytes = sha256_bytes(combined.as_bytes());
    let hash_hex = hex_encode(&hash_bytes);
    let h_str = &hash_hex[..13.min(hash_hex.len())];
    let h = u128::from_str_radix(h_str, 16).unwrap_or(0);
    if h % 33 == 0 {
        return 1000;
    }
    let e: u128 = 1u128 << 52;
    let numerator = 100u128 * e - h;
    let denominator = e - h;
    if denominator == 0 {
        return 1000;
    }
    let result = (numerator * 1000) / denominator;
    result.max(1000).min(1_000_000_000) as u64
}

fn multiplier_at_elapsed(elapsed_ms: u64) -> u64 {
    let t = elapsed_ms as u128;
    let rate = GROWTH_RATE_MILLI as u128;
    let growth = 1000u128 + (rate * t) / 1000;
    growth.min(1_000_000) as u64
}
