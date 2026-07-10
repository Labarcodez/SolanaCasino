# Orbit Solana Casino — UI/UX Perfection Plan

**Site:** [orbit-casino.com](https://orbit-casino.com/)  
**X:** [@OrbitSolCasino](https://x.com/OrbitSolCasino)  
**Email:** orbitsolanacasino@gmail.com  
**Discord:** https://discord.gg/tXHWmuQkS

**Product constraints (explicit):**
- **No** user-editable client seeds (server commit-reveal only, like [Rugs.fun verify](https://rugs.fun/verify))
- **No** XP/levels, crates/lootboxes, hourly chat airdrops, or battle pass
- **No** direct wallet / non-custodial per-bet mode — **deposit-first** custodial or Anchor PDA vault stays the model
- Focus: core casino UX, crash excellence, wallet deposit/withdraw speed, provably-fair transparency, VIP/affiliate/tournament retention

---

## Competitor Research — SolPump & Rugs.fun (Jul 2026)

### [SolPump](https://solpump.io/) — patterns we adopt

| Capability | SolPump | Orbit | Priority |
|------------|---------|-------|----------|
| **Wallet** | Non-custodial per-bet | **Deposit-first vault** (by design) | N/A — out of scope |
| **Crash** | Rocket, dual bet, auto-cashout | Dual bet ✅, rocket FX, per-slot auto | Polish |
| **Provably fair** | On-chain verify | Commit-reveal + modal + `/verify` | Good |
| **Retention** | Airdrops, cases, token | VIP rakeback, affiliate, tournament | **Ours** |
| **Chat** | Live + airdrop gates | Auth-gated live chat | Polish only |

Sources: [SolPump](https://solpump.io/), [crash dual-bet rules](https://crashgames.guide/blog/crash-game-rules/), [auto-cashout guide](https://crashgames.guide/blog/auto-cashout-guide/)

**Dual bet research ([Aviator pattern](https://crashgames.guide/blog/auto-cashout-strategy/)):**
- Two independent stakes on the **same** crash curve per round
- Each panel has its own auto-cashout target (e.g. Bet A @ 1.5× grind, Bet B @ 5× moonshot)
- Not a hedge — stake split across two exit points ([Cricket Duel demo](https://cricket-duel.com/))
- Stake Crash is **single bet**; Aviator/SolPump-style platforms use dual panels

### [Rugs.fun](https://rugs.fun/) — patterns we adopt vs skip

| Capability | Rugs.fun | Orbit |
|------------|----------|-------|
| Chart | Candlestick rug | Classic crash + rocket (our identity) |
| Retention | XP, RugPass, crates | **Skip** — VIP/affiliate/tournament |
| Verify | Public `/verify` | `/verify` → fairness panel ✅ |
| Fairness | Server seed + game ID | Same — no user client seeds |

---

## Build tiers (revised)

**Tier 1 — Ship next**
1. ~~**Dual bet panel**~~ ✅ Bet A / Bet B with independent auto-cashout
2. ~~**Crash power UX**~~ ✅ PnL card, cashing out state, shortcuts, auto line on chart
3. ~~**WebSocket reconnect banner**~~ ✅
4. ~~**Optimistic balance + tx status banners**~~ ✅ Pending → Confirming + Solscan link
5. **Unified connect modal** — Phantom / Google / Apple
6. ~~**Public `/verify` route**~~ ✅ alias to fairness panel

**Tier 2 — Core depth**
7. **Auto-bet strategies** — stop-on-win/loss, N rounds (Stake auto-mode style, not martingale by default)
8. **Transaction history UI** — filterable bets/deposits/withdrawals
9. **Landing hero** — embedded live crash spectator
10. **Mobile crash layout** — dual panels stack; chat/bets as bottom sheets

**Tier 3 — Optional**
11. Jackpot / pooled rounds
12. Optional rug-style chart skin (visual only)
13. Pump.fun token display (no wager-to-earn unless requested)

### Explicitly out of scope

- User-editable client seeds
- Direct wallet / non-custodial per-bet betting
- XP / levels / battle pass / crates / daily case
- Hourly chat airdrops
- Gamification achievements

---

## Current state

### Strong
- Three games + provably-fair backend + hybrid on-chain
- Guest spectator, clean URLs, in-game fairness modal
- **Dual crash bet** (custodial), rocket chart FX, focus mode
- VIP rakeback, affiliate, tournament, 18 E2E tests

### Gaps
- Connect modal fragmentation
- Leaderboard/tournament nav visibility
- Authenticated game-play E2E

---

## Phase summary (condensed)

| Phase | Focus | Key remaining |
|-------|-------|---------------|
| 1 | Design system | Tokens, CSS split |
| 2 | Onboarding | Connect modal, zero-balance CTA |
| 3 | Wallet | Optimistic balance, tx banners, tx history |
| 4 | Crash | ✅ Dual bet; mobile rewrite; auto-bet strategies |
| 5–6 | Limbo/Coinflip | Gauge, coin polish, mobile |
| 7 | Trust | `/verify` ✅; bet history verify links |
| 8 | Mobile | Bottom sheets, 5-item nav |
| 9 | Social | Leaderboard nav, chat bet-share cards |
| 10 | Perf | Skeletons, sound polish |
| 11 | QA | Auth game E2E, load test |
| 12 | Landing | Live crash hero, SEO |

---

## Priority order

1. Unified connect modal
2. Mobile crash layout (bottom sheets)
4. Auto-bet strategies (Stake-style auto mode)
5. Transaction history UI
6. Landing hero with live crash

---

## Competitive benchmark (revised)

| Feature | SolPump | Rugs.fun | Orbit now | Target |
|---------|---------|----------|-----------|--------|
| Deposit-first wallet | — | Yes | Yes | Yes (keep) |
| Dual crash bet | Yes | — | Yes ✅ | Yes |
| Auto-cashout per panel | Yes | — | Yes ✅ | Yes |
| Public verify page | Partial | Yes | `/verify` ✅ | Yes |
| XP/crates/airdrops | Yes | Yes | **No** | **No** |
| Direct wallet bet | Yes | — | **No** | **No** |
| VIP/affiliate/tournament | Partial | Partial | Yes | Polish UI |

---

## Summary

Orbit competes on **game feel + trust + deposit UX**, not gamification loops or non-custodial wallet betting. Dual bet is live. Next wins: **tx status banners**, **connect modal**, and **mobile crash layout**.
