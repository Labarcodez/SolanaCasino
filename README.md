# SolCasino — Real SOL Gambling on Solana

A full-stack Solana casino with **real mainnet SOL** deposits, withdrawals, and provably fair games. Built in the style of [solpump.io](https://solpump.io) and Rugs.fun.

## Features

- **Real SOL gambling** on Solana mainnet — no mock balances
- **Phantom wallet** sign-in (browser extension)
- **Email sign-in** via Google/Apple OAuth (Phantom embedded wallet)
- **Crash game** — multiplier climbs until crash; cash out before it busts
- **Coinflip** — instant heads/tails with 95% RTP
- **Provably fair** — cryptographic server seeds verifiable after each round
- **On-chain deposits** — users sign real SOL transfers to the casino wallet
- **Automated withdrawals** — casino sends SOL back to player wallets
- **Leaderboard** and bet history

## Casino Wallet

```
FMmho438Vv1Y9nov4mtfHZ4pYSZV8NfubiCeCB3bbGCb
```

All deposits go to this address on Solana mainnet.

## Quick Start

### Prerequisites

- Node.js 20+
- A [Phantom Portal](https://phantom.com/portal) app ID (for Google/Apple email login)
- The casino wallet private key (for automated withdrawals only — never commit this)

### Install

```bash
npm install
```

### Configure Backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
CASINO_WALLET_ADDRESS=FMmho438Vv1Y9nov4mtfHZ4pYSZV8NfubiCeCB3bbGCb
CASINO_WALLET_PRIVATE_KEY=your_base58_private_key_here
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

> **Security:** Never commit `CASINO_WALLET_PRIVATE_KEY`. Store it in environment variables or a secrets manager.

### Configure Frontend

```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:

```env
VITE_PHANTOM_APP_ID=your_phantom_portal_app_id
VITE_CASINO_WALLET=FMmho438Vv1Y9nov4mtfHZ4pYSZV8NfubiCeCB3bbGCb
```

Register your app at [Phantom Portal](https://phantom.com/portal) and allowlist:
- `http://localhost:5173`
- `http://localhost:5173/auth/callback`

### Run

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## How It Works

### Deposits

1. User connects Phantom wallet or signs in with Google/Apple email
2. User enters deposit amount and clicks **Deposit SOL**
3. Phantom prompts user to sign a real `SystemProgram.transfer` to the casino wallet
4. Backend verifies the on-chain transaction and credits the user's casino balance

### Playing

- **Crash**: Place a bet during the 8-second betting window. Watch the multiplier rise. Click **Cash Out** before the crash, or set an auto-cashout multiplier.
- **Coinflip**: Pick heads or tails, set your bet, and flip. Win ~1.9x your bet (95% RTP).

### Withdrawals

1. User clicks **Withdraw** and enters amount
2. Backend deducts from casino balance and sends SOL from the casino wallet to the user's address
3. Requires `CASINO_WALLET_PRIVATE_KEY` on the server

### Provably Fair

Each crash round publishes a `serverSeedHash` before betting opens. After the round crashes, the `serverSeed` is revealed. Players can verify the crash point was predetermined and fair.

## Project Structure

```
├── frontend/          # React + Vite + Phantom Connect SDK
│   └── src/
│       ├── components/   # UI components
│       ├── games/        # Crash, Coinflip
│       ├── hooks/        # Wallet, socket hooks
│       └── lib/          # API client, Solana utils
├── backend/           # Express + Socket.IO + SQLite
│   └── src/
│       ├── services/     # Crash engine, coinflip, Solana
│       ├── routes/       # REST API
│       └── db/           # SQLite database
└── package.json       # Workspace root
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Casino configuration |
| GET | `/api/user/:address` | User balance and stats |
| POST | `/api/deposit/verify` | Verify on-chain deposit |
| POST | `/api/withdraw` | Withdraw SOL to wallet |
| POST | `/api/coinflip` | Play coinflip |
| GET | `/api/history/:address` | Bet history |
| GET | `/api/leaderboard` | Top players |

### WebSocket Events (Crash)

| Event | Direction | Description |
|-------|-----------|-------------|
| `crash:state` | Server → Client | Full round state |
| `crash:bet` | Client → Server | Place a bet |
| `crash:cashout` | Client → Server | Cash out active bet |
| `crash:tick` | Server → Client | Multiplier update |
| `crash:crashed` | Server → Client | Round ended |

## Production Deployment

1. Set `FRONTEND_URL` in backend `.env` to your production domain
2. Allowlist production URLs in Phantom Portal
3. Use a dedicated RPC endpoint (Helius, QuickNode, etc.) for reliability
4. Store `CASINO_WALLET_PRIVATE_KEY` in your hosting provider's secrets manager
5. Build: `npm run build`
6. Start: `npm run start`

## Disclaimer

This is real-money gambling on Solana mainnet. Users gamble their own SOL. Operators are responsible for compliance with local gambling laws and regulations. Gamble responsibly.
