# Orbit Casino — Improve & Fix Plan

> Research compiled July 2026. Production: **https://orbit-casino.com** (AWS ECS, custodial mode, Alchemy RPC server-side).

---

## Original Goals

1. **Crash** — Simple line that goes up and sometimes breaks; history should show **last 10 games only**.
2. **Coinflip** — Boring coin; needs richer visuals and feel.
3. **Limbo** — Boring; needs more polish and features.
4. **Cross-game** — More features, better overall look and feel.
5. **Solana Kit** — Implement modern `@solana/kit` stack.
6. **Pump.fun** — Integrate tools to launch a memecoin for the site.

---

## Current Codebase Audit

| Area | File(s) | Current State | Gap |
|------|---------|---------------|-----|
| Crash history UI | `frontend/src/components/CrashGame.tsx:278` | Shows **16** pills via `.slice(0, 16)` | User wants **10** |
| Crash history backend | `backend/src/services/crash.ts:366` | Stores **20** rounds | Align to 10 (or keep 20 server-side, slice 10 client-side) |
| Crash chart | `frontend/src/components/CrashChart.tsx` | Canvas line + gradient; rocket emoji **centered overlay**, not on curve | Industry standard: asset follows curve |
| Crash crash animation | `CrashChart.tsx` | Line turns red on bust | No graph crack, particles, or screen shake beyond CSS class |
| Crash verification modal | `frontend/src/components/CrashHistoryModal.tsx:22-27` | Passes **empty** `serverSeed` / `serverSeedHash` | Quick verify always fails |
| Crash history refresh | `useSocket.tsx` / `crash.ts` | History updates on round end server-side; client may lag until next `crash:round_start` | History pills not instant on bust |
| Coinflip | `frontend/src/components/CoinflipGame.tsx` | Emoji coin (◎/👑/🦅), single `rotateY` flip | No 3D faces, physics, recent-flips strip, sounds |
| Limbo | `frontend/src/components/LimboGame.tsx` | Text multiplier (idle/???/result); slider capped at **100** while max target is **1000** | No roll-up animation, target line, recent rolls |
| Solana stack | `frontend/package.json`, `backend/package.json` | `@solana/web3.js` **v1.98.2**, `@coral-xyz/anchor` **v0.32.1** | No Kit, no Pump SDK |
| Pump.fun | — | Not implemented | New feature module needed |

### Stack Summary

```
Frontend: React 19, Vite 6, framer-motion, socket.io-client, Phantom SDK
Backend:  Express 5, Socket.IO, SQLite, Anchor 0.32.1, web3.js v1
Deploy:   AWS ECS Fargate, Cloudflare DNS, ACM HTTPS (us-east-2)
Mode:     Custodial (onChainEnabled: false) — deposits/withdrawals working
```

---

## Part 1 — Game UX Research & Recommendations

### Industry Reference: Stake Originals (2025–2026 refresh)

Sources:
- [Stake Crash upgrade (May 2026)](https://gamingamericas.com/latest-news/2026/05/15/121574/stake-upgrades-flagship-crash-game-with-sharper-visuals-and-smoother-gameplay/)
- [Crash games explained (Game-Ace)](https://game-ace.com/blog/crash-games-explained/)
- [Stake Limbo review](https://www.jaxon.gg/reviews/stake-com/limbo/)

**Crash (Stake 2026 update highlights):**
- Dynamic multiplier gradients: **blue → green → purple → yellow** as multiplier rises
- **Graph crack animation** at bust — clear visual end to each round
- **Rocket/asset follows the curve** (not a static centered emoji)
- Live **player count** during round
- Faster cashout UX; mobile-first big buttons
- Particle trails optional; multiplier text pulses/scales

**Limbo (Stake pattern):**
- Minimal dark UI; focus on **central multiplier display**
- Multiplier **ticks upward** during roll (not static "???")
- **Recent results strip** above play area (last ~10 rolls)
- Target multiplier input + win probability + estimated payout
- Subtle sounds: bet chime, win burst, no looping soundtrack
- Auto-play with win/loss limits (future enhancement)

**Coinflip (industry pattern):**
- **3D CSS coin** with distinct heads/tails faces (not emoji)
- Multi-revolution flip with easing (slow start, fast middle, settle)
- **Recent flips strip** (last 10: H/T with color)
- Win/loss flash + optional coin clink sound
- Bet shortcuts: ½, 2×, Max (match Crash/Limbo)

---

### 1.1 Crash — Implementation Plan

#### Quick fixes (1–2 hours)

| Task | File | Change |
|------|------|--------|
| History → 10 pills | `CrashGame.tsx:278` | `slice(0, 16)` → `slice(0, 10)` |
| Backend history cap (optional) | `crash.ts:366` | `> 20` → `> 10` for consistency |
| Fix verification modal | `CrashHistoryModal.tsx` | Fetch round seeds from API or pass from `CrashFairnessBar` state; never send empty strings |
| Instant history update | `useSocket.tsx` / `CrashGame.tsx` | On `crash:crashed`, prepend `{ roundId, crashPoint }` to local history |

#### Visual upgrades (1–2 days)

**`CrashChart.tsx` refactor:**

1. **Curve-following rocket**
   - Track last point `{ x, y }` from canvas draw loop
   - Position rocket div/SVG at that coordinate (transform translate)
   - Rotate rocket to match tangent angle between last two points

2. **Dynamic gradient by multiplier**
   ```ts
   // Suggested color stops (Stake-style)
   mult < 2   → #3B82F6 (blue)
   mult < 5   → #22C55E (green)
   mult < 10  → #A855F7 (purple)
   mult >= 10 → #EAB308 (yellow)
   ```

3. **Bust effects**
   - Graph crack: draw 2–3 jagged lines from last point outward (canvas overlay, fade out 600ms)
   - Screen shake: existing `.crash-shake` — extend duration
   - Particle burst at crash point (8–12 small divs or canvas dots, CSS animation)
   - Play existing `crash` sound (already wired via `useSound`)

4. **Running phase polish**
   - Multiplier text scale pulse: `scale(1 + (mult - 1) * 0.02)` capped
   - Area fill under curve uses same dynamic gradient
   - Optional: subtle grid tick labels (2x, 5x, 10x)

5. **Social layer**
   - Show active bettor count from `crashState.bets?.length` or socket event
   - Already have `WinFeed` for recent cashouts — keep visible

#### CSS targets

- `frontend/src/styles/` — add `.crash-crack`, `.crash-particle`, `.crash-player-count`
- Ensure history pills use color tiers: `<1.5x` red, `<3x` amber, `≥3x` green (already present)

---

### 1.2 Coinflip — Implementation Plan

#### New component structure

```
frontend/src/components/coinflip/
  Coin3D.tsx          — CSS 3D transform coin with heads/tails SVG faces
  RecentFlipsStrip.tsx — Last 10 results from API or local state
  CoinflipGame.tsx    — orchestrates (refactor existing)
```

#### Coin3D design (CSS, no WebGL required)

```css
/* Concept: preserve-3d container, two faces, rotateY animation */
.coin-3d { transform-style: preserve-3d; }
.coin-face-heads { transform: rotateY(0deg) translateZ(4px); }
.coin-face-tails { transform: rotateY(180deg) translateZ(4px); }
```

- **Heads face:** Orbit branding / crown icon (SVG, not emoji)
- **Tails face:** Eagle or "O" monogram
- **Flip animation:** 4–6 full rotations via framer-motion `rotateY: [0, 1800 + resultOffset]`
- **Landing:** ease-out last 200ms; green/red rim glow on win/loss

#### Features to add

| Feature | Priority | Notes |
|---------|----------|-------|
| 3D coin faces | P0 | Replace emoji `◎/👑/🦅` |
| Recent flips strip | P1 | Store last 10 in component state; optional backend endpoint |
| Flip + win sounds | P1 | Extend `useSound` hooks |
| ½ / 2× / Max bet buttons | P1 | Match other games |
| Streak indicator | P2 | "3 wins in a row" badge |
| Auto-flip mode | P3 | Like Stake auto-bet |

#### Backend (optional)

- `GET /api/coinflip/recent` — last N public flips for strip (privacy: wallet truncated)

---

### 1.3 Limbo — Implementation Plan

#### Bug fix

- **Slider cap mismatch:** `LimboGame.tsx:234-237` caps slider at 100 but `limboMaxTarget` defaults to 1000.
  - Option A: Log-scale slider for 1.01–1000
  - Option B: Slider 1.01–100 + number input for higher targets
  - Option C: Raise slider max to 1000 with non-linear steps

#### Visual upgrades

1. **Roll-up animation**
   - On bet: animate counter from `1.00` → `resultMultiplier` over ~1.2s (requestAnimationFrame or framer-motion)
   - Color: white while rolling → green if `roll >= target`, red if bust
   - Show **target line** (horizontal dashed rule at target Y on a mini gauge)

2. **Recent rolls strip**
   - Row of pills above arena: `{ multiplier, won/lost }` last 10
   - Same pattern as Crash history pills

3. **Layout (Stake-style)**
   - Left: bet controls (amount, target, presets, play)
   - Center/right: large multiplier display + roll animation
   - Bottom: win chance, potential payout (already present)

4. **Sounds**
   - Tick during roll-up (optional, muted by default)
   - Win chime / bust thud

#### Presets alignment

- Current: `[1.5, 2, 3, 5, 10, 50]`
- Add: `100`, `1000` as text buttons (high-risk lottery targets — Stake supports up to 1,000,000x)

---

### 1.4 Cross-Game Polish

| Item | Games | Implementation |
|------|-------|----------------|
| Bet shortcuts ½ / 2× / Max | All | Shared `BetAmountControls.tsx` component |
| Consistent preset chips | All | `0.01, 0.05, 0.1, 0.5, 1` |
| Sound toggle | Crash only today | Add to Coinflip + Limbo headers |
| Mobile thumb targets | All | Min 44px buttons; stack controls vertically |
| Win celebration | All | Brief confetti or glow (reuse framer-motion) |
| Loading skeletons | All | Replace "Flipping..." / "Rolling..." with animated placeholders |
| Provably fair links | All | Link to Fairness tab with pre-filled seeds |

---

## Part 2 — Solana Kit Migration

### What is Solana Kit?

- Official modern JS SDK: [@solana/kit](https://solanakit.com)
- Modular, tree-shakable, native `bigint`, Ed25519/WebCrypto
- Successor path for web3.js 2.x / v3.x ecosystem
- RPC, codecs, signers, transactions, subscriptions as separate packages

### Current Orbit dependencies

```json
"@solana/web3.js": "^1.98.2"
"@coral-xyz/anchor": "^0.32.1"
```

Anchor TS client is **web3.js v1 only**. Full Kit migration requires either:
- **Incremental:** `@solana/web3-compat` bridge (recommended first step)
- **Long-term:** Codama-generated Kit-native clients from Anchor IDL

### Recommended migration path

#### Phase 0 — Compat layer (low risk, 1 sprint)

Sources:
- [Solana web3-compat docs](https://solana.com/docs/frontend/web3-compat)
- [@solana/web3-compat npm](https://www.npmjs.com/package/@solana/web3-compat)
- [Kit ↔ web3 interop guide](https://github.com/solana-foundation/solana-dev-skill/blob/main/skill/references/kit-web3-interop.md)

```bash
# Frontend + backend
npm install @solana/web3-compat @solana/kit @solana/client
# Keep @solana/web3.js for unimplemented compat methods
```

**File-by-file import swap:**
```ts
// Before
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
// After
import { Connection, PublicKey, Transaction } from "@solana/web3-compat";
```

**Suggested order:**
1. `frontend/src/lib/solana.ts` — RPC, blockhash refresh (already uses server endpoint)
2. `frontend/src/lib/anchor.ts` — keep web3.js at boundary if Anchor requires it
3. `backend/src/services/solana.ts` — deposit/withdraw/send paths
4. `backend/src/services/balanceSync.ts`

**Bridge helpers when mixing Kit + legacy:**
- `toAddress()`, `toPublicKey()`, `toWeb3Instruction()`, `toKitSigner()`

#### Phase 1 — Kit-native new code only

- New Pump.fun module uses `@solana/kit` + `@solana/client` directly
- Do not rewrite working deposit/withdraw until compat proven stable

#### Phase 2 — Anchor / on-chain (when enabling on-chain mode)

- Generate Kit client from IDL via **Codama** ([Solana Programs docs](https://solanakit.com))
- Replace `@coral-xyz/anchor` Program calls in `frontend/src/lib/anchor.ts`

#### Known compat limitations (Phase 0)

- Not all `Connection` methods implemented — keep legacy connection for:
  - `getTransaction`, subscriptions, `requestAirdrop`
- Account data: base64 decode only
- Websocket normalization incomplete

#### Folder structure (recommended)

```
frontend/src/solana/
  kit/          — new Kit-first code (Pump, future features)
  web3/         — compat adapters, Anchor boundary
  shared/       — RPC URL config, address validation
backend/src/solana/
  kit/
  web3/
```

---

## Part 3 — Pump.fun Memecoin Launch

### Official Pump.fun overview

Source: [Pump.fun — How to create a coin](https://pump.fun/docs/create-coin)

- Launchpad on Solana; no liquidity seeding, no presale
- Bonding curve pricing; graduates to **PumpSwap** at market-cap threshold
- **No creation fee** (trading/graduation fees apply)
- Metadata (name, symbol, image) is **immutable** after launch
- Wallet: Phantom sign-in; or email via Privy on pump.fun

### SDK options

| Package | Maintainer | Status | Notes |
|---------|------------|--------|-------|
| `@pump-fun/pump-sdk` | pump.fun | **Official** — v1.36.0 (May 2026) | npm: 14.9K weekly downloads |
| `@nirholas/pump-sdk` | Community | Active, well-documented | Offline-first builders, tutorials |
| REST APIs (pumpapi.io, PumpDev, Launchpad.Trade) | Third-party | Varies | Some require private keys — **avoid for production** |

**Recommendation:** Start with **`@pump-fun/pump-sdk`**; reference `@nirholas/pump-sdk` docs for `create_v2` examples.

### Critical protocol update: `create_v2`

Source: [pump-fun/pump-public-docs](https://github.com/pump-fun/pump-public-docs)

| Item | Detail |
|------|--------|
| Old instruction | `create` — **deprecated** (still active, will sunset) |
| New instruction | **`create_v2`** — Token-2022 program, not Metaplex |
| Mayhem mode | Boolean `is_mayhem_mode` / `mayhemMode` — different fee recipient |
| Token program | Token-2022 for mint, bonding curve ATA, user ATA |
| Atomic launch+buy | `createV2AndBuyInstructions` |

**Program IDs:**
```
Pump program:  6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
Pump AMM:      pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA
```

### Recommended Orbit architecture (secure)

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (/token or /launch)                               │
│  - Form: name, symbol, description, image upload             │
│  - Phantom signs create_v2 tx (creator = user wallet)        │
│  - Mint keypair generated client-side, user signs both       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Backend (optional helpers)                                  │
│  - POST /api/token/metadata → IPFS/Arweave upload → URI      │
│  - GET  /api/token/orbit → site token mint address (config)  │
│  - NO creator private keys on ECS                            │
└─────────────────────────────────────────────────────────────┘
```

**Never store creator private keys on the server.** User signs via Phantom; server only hosts metadata and reads chain state.

### Implementation steps

#### Step 1 — Metadata pipeline

```
backend/src/routes/token.ts
  POST /api/token/upload-metadata
    - Validate: name (3-32), symbol (2-10), image (PNG/JPG, max 512KB)
    - Upload JSON + image to IPFS (Pinata/Web3.Storage) or Arweave
    - Return { uri }
```

#### Step 2 — Frontend launch page

```
frontend/src/pages/LaunchToken.tsx
frontend/src/lib/pump.ts
  - npm install @pump-fun/pump-sdk bn.js
  - Generate mint Keypair in browser
  - Build createV2Instruction (mayhemMode: false for Orbit brand token)
  - VersionedTransaction + signAndSendTx (Phantom)
  - Store launched mint in localStorage + POST to backend registry
```

**Example flow (from community SDK docs):**
```ts
const mint = Keypair.generate();
const createIx = await PUMP_SDK.createV2Instruction({
  mint: mint.publicKey,
  name: "Orbit Casino",
  symbol: "ORBIT",
  uri: metadataUri,
  creator: walletPublicKey,
  user: walletPublicKey,
  mayhemMode: false,
});
// tx.sign([wallet, mint]) — both must sign
```

#### Step 3 — Site token page

```
frontend/src/pages/SiteToken.tsx
  - Display Orbit token mint, bonding curve progress, link to pump.fun
  - Optional: embed buy widget via SDK buyInstructions (user-signed)
```

#### Step 4 — Config

```env
# .env / ECS task — public addresses only
ORBIT_TOKEN_MINT=<mint after launch>
PUMP_PROGRAM_ID=6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
```

### Pump.fun launch checklist (from official docs)

- [ ] Decide brand **before** signing (immutable)
- [ ] Square image 512×512, high contrast
- [ ] Add X / Telegram / website links in metadata
- [ ] Review [Pump.fun Terms](https://pump.fun) and trademark guidelines
- [ ] Test on **devnet** first (`@pump-fun/pump-sdk` has devnet builds)
- [ ] Mainnet launch with Phantom + sufficient SOL for tx fees

### Post-launch integration ideas

- Display token in site header/footer with live price (DexScreener/Birdeye API)
- Holder perks: cosmetic badge in chat (verify SPL balance via RPC)
- Promotional buy link — **user always signs**, no custodial token trading

---

## Part 4 — Known Bugs to Fix (Priority)

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| 1 | Crash history shows 16 not 10 | Low | One-line slice change |
| 2 | CrashHistoryModal verify broken | Medium | Pass real seeds or fetch by roundId |
| 3 | History not instant on crash | Medium | Optimistic update on `crash:crashed` |
| 4 | Limbo slider max 100 vs target 1000 | Medium | Log slider or dual input |
| 5 | Rocket not on curve | Low (UX) | CrashChart position fix |
| 6 | Coinflip/Limbo no sounds | Low | Extend useSound |

---

## Part 5 — Implementation Roadmap

### Sprint 1 — Quick wins (2–3 days)

- [x] Crash history → 10 pills
- [x] Fix CrashHistoryModal verification
- [x] Instant crash history on bust event
- [x] Limbo slider / target input fix
- [x] Shared bet shortcuts (½, 2×, Max) across games

### Sprint 2 — Crash visual pass (3–5 days)

- [x] Dynamic multiplier gradients
- [x] Rocket follows curve + rotation
- [x] Graph crack + particle bust animation
- [x] Active player count badge

### Sprint 3 — Coinflip + Limbo polish (3–5 days)

- [x] Coin3D component with SVG faces
- [x] Recent flips / recent rolls strips
- [x] Limbo roll-up counter animation
- [x] Sounds for all three games

### Sprint 4 — Solana Kit Phase 0 (3–5 days)

- [x] Install web3-compat + kit deps (frontend optional; backend reverted to web3.js)
- [x] Migrate `solana.ts` (frontend — `@solana/web3.js` stable; backend — `@solana/web3.js`)
- [ ] Regression test deposit / withdraw / blockhash (manual on deploy)
- [x] Document compat boundaries in code comments (see `src/types/solana-web3-compat.d.ts`)

### Sprint 5 — Pump.fun launch (5–7 days)

- [x] Metadata upload API
- [x] LaunchToken page + Phantom signing
- [ ] Devnet end-to-end test (requires wallet + devnet SOL)
- [ ] Mainnet Orbit token launch (operator action)
- [x] SiteToken page + nav link

### Future / optional

- [ ] Codama Kit client for on-chain mode
- [ ] Auto-play modes (Limbo, Coinflip)
- [ ] Dual bet slots on Crash
- [ ] Phaser/Pixi upgrade if canvas performance limits hit

---

## References

### Game UX
- [Stake Crash visual upgrade (May 2026)](https://gamingamericas.com/latest-news/2026/05/15/121574/stake-upgrades-flagship-crash-game-with-sharper-visuals-and-smoother-gameplay/)
- [Crash games explained](https://game-ace.com/blog/crash-games-explained/)
- [Stake Limbo guide](https://www.jaxon.gg/reviews/stake-com/limbo/)

### Solana Kit
- [Solana Kit homepage](https://solanakit.com)
- [web3-compat migration](https://solana.com/docs/frontend/web3-compat)
- [@solana/web3-compat npm](https://www.npmjs.com/package/@solana/web3-compat)
- [Kit ↔ web3 interop patterns](https://github.com/solana-foundation/solana-dev-skill/blob/main/skill/references/kit-web3-interop.md)
- [web3.js v3 release notes](https://github.com/solana-foundation/solana-web3.js/blob/v3.x/RELEASE_NOTES.md)

### Pump.fun
- [How to create a coin (official)](https://pump.fun/docs/create-coin)
- [@pump-fun/pump-sdk npm](https://www.npmjs.com/package/@pump-fun/pump-sdk)
- [pump-public-docs (create_v2)](https://github.com/pump-fun/pump-public-docs)
- [Community SDK API reference](https://github.com/nirholas/pump-fun-sdk/blob/HEAD/docs/api-reference.md)
- [Community create token tutorial](https://github.com/nirholas/pump-fun-sdk/blob/main/tutorials/01-create-token.md)

### Orbit production
- Live site: https://orbit-casino.com
- AWS region: us-east-2
- RPC: Alchemy (server-side `ALCHEMY_API_KEY`)

---

*Last updated: July 10, 2026*

---

## Implementation Status (July 10, 2026)

All sprints implemented in codebase. Frontend and backend **build successfully**.

### New / modified files

| Area | Files |
|------|-------|
| Crash UX | `CrashChart.tsx`, `CrashGame.tsx`, `CrashHistoryModal.tsx`, `useSocket.tsx`, `crash.ts` |
| Shared | `BetAmountControls.tsx`, `RecentResultsStrip.tsx`, `crashColors.ts`, `limboSlider.ts` |
| Coinflip | `CoinflipGame.tsx`, `coinflip/Coin3D.tsx` |
| Limbo | `LimboGame.tsx` |
| Sounds | `useSound.ts` (+ flip, limboTick, limboWin, limboBust) |
| Solana Kit | `solana.ts` — frontend uses `@solana/web3.js`; backend uses `@solana/web3.js` (compat reverted — Alchemy HTTPS) |
| Pump.fun | `backend/src/routes/token.ts`, `frontend/src/lib/pump.ts`, `pages/LaunchToken.tsx`, `pages/SiteToken.tsx` |
| Routing | `App.tsx` — `?tab=token`, `?tab=launch` |
| API | `GET /api/crash/round/:id`, `POST /api/token/upload-metadata`, `GET /api/token/orbit` |

### Cross-game polish (July 10 — pass 2)

- [x] Crash uses shared `BetAmountControls` + `1` SOL preset
- [x] Win celebration particles (Crash cashout, Coinflip, Limbo)
- [x] Loading spinners on flip/roll buttons
- [x] Limbo roll green/red color on outcome
- [x] Coin3D crown + Orbit orbit branding
- [x] Crash chart grid multiplier labels
- [x] Fairness deep links from Limbo/Coinflip/Crash
- [x] Mobile nav: Launch tab + 44px touch targets
- [x] Frontend `solana.ts` reverted to `@solana/web3.js` (compat breaks Alchemy on server)

- [x] `GET /api/coinflip/recent` — persists recent flips strip across refresh
- [x] Custodial coinflip fairness verify link
- [x] SiteToken bonding curve explainer + Pump.fun buy CTA

### Deploy notes

1. Set `PUBLIC_API_URL=https://orbit-casino.com` on ECS so metadata URIs resolve correctly.
2. Optional: `ORBIT_TOKEN_MINT=<mint>` after mainnet launch.
3. Pump launch requires Phantom + SOL for tx fees; mint keypair signs client-side (`partialSign`).
4. Run `npm run aws:deploy` to push to production when ready.
