# Orbit Solana Casino — UI/UX Perfection Plan

**Site:** [orbit-casino.com](https://orbit-casino.com/)  
**X:** [@OrbitSolCasino](https://x.com/OrbitSolCasino)  
**Email:** orbitsolanacasino@gmail.com  
**Discord:** https://discord.gg/tXHWmuQkS

---

## Competitor Research — SolPump & Rugs.fun (Jul 2026)

### [SolPump](https://solpump.io/) — What makes it “fully functioning”

| Capability | SolPump | Orbit (current) | Gap priority |
|------------|---------|-----------------|--------------|
| **Wallet model** | Non-custodial — bet directly from Phantom/Backpack/Solflare; no in-game balance | Custodial SQLite **or** Anchor PDA vault (deposit-first) | **P0** — architectural |
| **Crash game** | Rocket flies across screen; multiplier climbs; dual bet; auto-cashout; advanced betting | Single bet; auto-cashout; canvas chart + rocket FX (v2) | **P1** |
| **Other games** | Crash, Coinflip, **Futures** | Crash, Limbo, Coinflip | P2 |
| **Rewards loop** | Hourly chat airdrops, daily free case, `$SOLPUMP` earn-by-wagering | VIP rakeback, affiliate, weekly tournament | **P1** |
| **Chat** | Live chat tied to airdrop eligibility (0.001 SOL wager/hour) | Auth-gated chat, no rewards | **P1** |
| **Provably fair** | On-chain + verify; marketed as 100% fair | Commit-reveal + API verify + in-game modal | Partial — client seed UX |
| **Token** | Native `$SOLPUMP` with wager rewards | Pump.fun launch page only | P2 |
| **Jackpot** | Pooled 60s jackpot mode | None | P3 |

Sources: [SolPump](https://solpump.io/), [DappRadar](https://dappradar.com/dapp/solpump), [ProvenCrypto review](https://provencrypto.com/solpump-review/)

### [Rugs.fun](https://rugs.fun/) — What makes it “fully functioning”

| Capability | Rugs.fun | Orbit (current) | Gap priority |
|------------|----------|-----------------|--------------|
| **Game identity** | Fake **candlestick trading chart** — buy/sell before rug | Classic exponential crash curve | **P2** (different product) |
| **Retention** | XP per bet, RugPass tiers, crates (Iron→Celestial), daily tasks | VIP rakeback only | **P1** |
| **Community** | Rugpool jackpot, Piggy Bank (Tier 25), referral crates | Tournament + affiliate | P2 |
| **Visual drama** | Chart wicks, god candles, rug flash to ~0 | Rocket + starfield canvas (v2) | Ongoing polish |
| **Verify page** | Public `/verify` tool with algorithm shown | In-app FairnessPanel only | P2 |
| **Provably fair** | Server seed + game ID only (no client seed) | Same pattern + optional client seed (custodial) | Orbit is comparable |

Sources: [Rugs.fun verify](https://rugs.fun/verify), [beginner guide](https://medium.com/@tripwireonfire/how-to-play-rugs-fun-a-beginners-guide-to-the-basics-of-the-best-web3-game-on-solana-e103ba44a793)

### What Orbit must build to match competitor “full product” feel

**Tier 1 — Ship next (2–3 weeks)**  
1. **Dual bet panel** (Bet A / Bet B) — SolPump table stakes  
2. **Hourly chat airdrop** — wager gate + % of volume to pool  
3. **Daily free case** — onboarding hook like SolPump daily case  
4. **XP + level system** — bet → XP → crate keys (Rugs.fun loop)  
5. **Crash power UX** — sticky PnL card, “cashing out…” state, keyboard Space = cashout  
6. **Client seed editor** — user sets seed before bet (trust parity)

**Tier 2 — Core product depth (3–5 weeks)**  
7. **Direct wallet betting mode** — optional non-custodial path (bet per tx, no deposit)  
8. **Auto-bet strategies** — stop-on-win/loss, N rounds, martingale toggle  
9. **Transaction history UI** — deposits, bets, withdrawals with Solscan links  
10. **Public `/verify` page** — standalone like Rugs.fun  
11. **Landing hero** — embed live crash spectator

**Tier 3 — Differentiation (5+ weeks)**  
12. **Orbit token earn loop** — wager → token rewards (SolPump model)  
13. **Jackpot / pooled rounds** — SolPump jackpot mode  
14. **Rug-style chart mode** (optional second crash skin) — candlestick variant  
15. **Battle pass / achievements** — Rugs.fun RugPass equivalent

### Crash visual direction (SolPump + Rugs.fun inspired)

| Element | SolPump | Rugs.fun | Orbit v2 (implemented) |
|---------|---------|----------|------------------------|
| Hero motion | Rocket flies screen | Candle wicks pump/dump | Canvas rocket + exhaust flame |
| Background | Dark space | Trading terminal | Parallax starfield + nebula |
| Speed feel | Streak lines at high mult | Volatility spikes | Speed streaks + pulse rings |
| Crash moment | Rocket explodes | Chart rugs to 0 | Particle burst + red flash + border pulse |
| Multiplier | Large center text | PnL % overlay | Dynamic color + scale pulse |

---

## Current State Assessment

### What's already strong
- Cohesive dark Orbit brand with purple/Solana-green accents
- Three fully wired games (Crash, Limbo, Coinflip) with sound, animations, and provably-fair backend
- Hybrid on-chain + real-time architecture
- Mobile bottom nav with safe-area support
- Live activity marquee, chat, live bets, win celebrations

### Critical gaps vs. Stake / Shuffle / industry leaders
- Games are locked behind wallet connect — no demo or preview mode
- Fairness tools live on a separate tab, not inline after each bet
- Crash layout stacks chat + live bets on mobile, burying the cash-out action
- No "focus mode," dual-bet panel, or advanced auto-bet controls
- Wallet flows lack optimistic balance updates and rich tx status
- Monolithic CSS (~3.6k lines) makes iteration slow
- Zero frontend/E2E tests for actual game play

---

## Master Improvement Plan

### Phase 1 — Foundation & Design System (Week 1)

| # | Task | Why |
|---|------|-----|
| 1.1 | **Extract design tokens** into a structured token file (`colors`, `spacing`, `typography`, `shadows`, `motion`) | Enables consistent changes across 3 games |
| 1.2 | **Componentize repeated patterns** — `GameCard`, `PrimaryCTA`, `StatPill`, `PhaseBadge`, `BetPanel`, `FairnessChip` | Reduces duplication across Crash/Limbo/Coinflip |
| 1.3 | **Split `index.css` + `theme.css`** into scoped modules per game + shared | Maintainability; faster iteration |
| 1.4 | **Enforce 44×44px minimum tap targets** on all interactive elements | Mobile error prevention (industry standard) |
| 1.5 | **Add `prefers-reduced-motion` coverage** for all Framer Motion animations | Accessibility compliance |
| 1.6 | **Clean up `frontend/frontend/`** accidental nested folder | Repo hygiene |
| 1.7 | **Implement clean URL routing** — `/crash`, `/limbo`, `/coinflip` (keep `?tab=` as fallback) | Shareable deep links, SEO, marketing |

---

### Phase 2 — Onboarding & First-Run UX (Week 1–2)

| # | Task | Why |
|---|------|-----|
| 2.1 | **Guest/demo mode** — let unauthenticated users watch Crash rounds and preview Limbo/Coinflip UI (bet buttons disabled with "Connect to play") | Stake/Shuffle show games immediately; reduces bounce |
| 2.2 | **Fix `?tab=crash` on landing** — when unauthenticated, scroll to game preview or show split hero + live crash spectator | URL promise doesn't match current behavior |
| 2.3 | **Unified connect modal** — single sheet with Phantom Extension, Phantom App (deep link), Google, Apple as equal visual options | Landing mentions Google/Apple but only shows pills |
| 2.4 | **Smart Phantom detection UX** — replace raw "extension not detected" with install CTA + "Continue with Google/Apple" fallback + mobile app deep link | Current message is a dead end |
| 2.5 | **3-step onboarding tooltip** after first connect: Deposit → Pick game → Play | Reduces confusion for Web3 newcomers |
| 2.6 | **Zero-balance empty state** — prominent "Deposit SOL" CTA with animated vault explainer when balance = 0 | Users connect then don't know what to do |
| 2.7 | **Persistent session indicator** — show connected wallet, network (devnet/mainnet), and balance in header at all times | Trust + orientation |

---

### Phase 3 — Wallet, Deposit & Withdraw Flows (Week 2)

| # | Task | Why |
|---|------|-----|
| 3.1 | **Optimistic balance updates** — update UI immediately on bet/deposit; reconcile on confirmation | Industry standard; feels instant |
| 3.2 | **Rich transaction status banners** — Pending → Confirming → Confirmed with Solscan link and ETA | #1 trust builder per 2026 Web3 UX research |
| 3.3 | **Withdrawal flow redesign** — amount picker, fee estimate, network warning, confirmation summary, real-time status until finality | Withdrawals cause the most support tickets |
| 3.4 | **Deposit QR + copy address** for mobile users sending from exchange | Reduces deposit friction |
| 3.5 | **Balance breakdown tooltip** — wallet SOL vs. vault balance vs. in-play bets | Clarity for hybrid custodial/on-chain mode |
| 3.6 | **Low-balance warning** before bet attempt with one-tap deposit shortcut | Prevents failed bet frustration |
| 3.7 | **Transaction history panel** — filterable by game, with status badges and explorer links | Transparency builds retention |

---

### Phase 4 — Crash Game Perfection (Week 2–3)

Crash is the flagship — every millisecond matters.

| # | Task | Why |
|---|------|-----|
| 4.1 | **Multiplier as hero** — enlarge center multiplier, color-shift as it climbs (green → gold → red), smooth 60fps canvas updates without strobing | Core tension driver |
| 4.2 | **Cash-out button redesign** — largest element on screen, bottom-center thumb zone on mobile, pulsing glow when active, instant press feedback | Most critical control in crash games |
| 4.3 | **Focus mode toggle** — hide chat + live bets during running phase; show only multiplier + cash-out | Reduces decision fatigue |
| 4.4 | **Dual bet panel** — two independent bet slots (Bet A / Bet B) like Stake | Power users expect this |
| 4.5 | **Auto-cashout UX upgrade** — slider + preset chips (1.5×, 2×, 5×, 10×), visual target line on chart, confirmation when triggered | Current control is functional but not prominent |
| 4.6 | **Auto-bet strategy panel** — stop-on-win, stop-on-loss, number of rounds, increase-on-loss (martingale toggle with warning) | Retention feature on top platforms |
| 4.7 | **Round history strip** — clickable crash points above chart; tap opens fairness verification pre-filled | Pattern visualization builds trust |
| 4.8 | **Phase state machine clarity** — distinct visual states for Betting (countdown bar) → Running (curve animating) → Crashed (explosion FX) → Cooldown (reset pulse) | Players must never wonder "what phase is this?" |
| 4.9 | **Mobile crash layout rewrite** — game + cash-out pinned to bottom 60%; chat/bets as swipe-up bottom sheets | Current stack buries cash-out below fold |
| 4.10 | **Latency compensation** — show "cashing out…" state immediately; reconcile server response; handle race conditions gracefully | Trust lives in milliseconds |
| 4.11 | **My bet status card** — sticky panel showing active bet amount, current profit, cash-out value in real time | Reduces mental math under pressure |
| 4.12 | **Keyboard shortcuts** (desktop) — Space = cash out, Enter = place bet | Power user retention |

---

### Phase 5 — Limbo Game Perfection (Week 3)

| # | Task | Why |
|---|------|-----|
| 5.1 | **Target multiplier gauge redesign** — larger arc/gauge with animated needle, color zones for risk level | Visual centerpiece |
| 5.2 | **Live stats row** — Win chance %, potential payout SOL, house edge, RTP always visible | Stake shows these inline; reduces anxiety |
| 5.3 | **Preset target chips** — make `[1.5, 2, 3, 5, 10, 50, 100, 1000]` thumb-friendly pills with win% labels | Faster target selection |
| 5.4 | **Roll animation polish** — consistent duration (no jitter), satisfying deceleration, win/loss color flash | Randomness must feel fair, not suspicious |
| 5.5 | **Result card** — post-roll panel with roll value, target, win/loss, profit, "Verify this bet" link | Inline fairness verification |
| 5.6 | **Recent results visualization** — bar/scatter chart of last 20 rolls showing distribution (not just strip) | Proves randomness visually |
| 5.7 | **Quick re-bet** — "Bet again" button with same amount/target after result | Reduces clicks per session |
| 5.8 | **Auto-roll mode** — N rolls with same settings, stop on win/loss threshold | Standard on competitor platforms |
| 5.9 | **Mobile layout** — bet controls + roll button in bottom thumb zone; gauge above | One-handed play |

---

### Phase 6 — Coinflip Game Perfection (Week 3)

| # | Task | Why |
|---|------|-----|
| 6.1 | **3D coin polish** — improve lighting, shadow, flip physics; ensure 60fps on mid-range mobile | Coin is the entire visual identity |
| 6.2 | **Heads/Tails selector redesign** — large tappable cards with coin faces, not small toggle buttons | Clear choice before flip |
| 6.3 | **Result reveal drama** — slow-mo final rotation, win confetti / loss dim, distinct sounds (fix: loss currently reuses `limboBust`) | Audio/visual consistency |
| 6.4 | **Streak tracker** — show last 10 results as H/T dots with "streak" label | Addresses gambler's fallacy with transparency |
| 6.5 | **Post-flip fairness chip** — one-tap "Verify" with seeds pre-populated | Trust at point of outcome |
| 6.6 | **Quick flip** — tap same choice again instantly after result | Speed is the product |
| 6.7 | **Auto-flip mode** — flip N times, stop on win count or loss limit | Parity with Limbo auto-roll |
| 6.8 | **Mobile** — coin centered, heads/tails + bet + flip in bottom panel | Thumb-zone layout |

---

### Phase 7 — Provably Fair & Trust UX (Week 3–4)

Trust is the competitive moat for crypto casinos.

| # | Task | Why |
|---|------|-----|
| 7.1 | **In-game fairness modal** (Stake-style) — accessible from every game via shield icon; not buried in "More" tab | Fairness must be encountered naturally |
| 7.2 | **Client seed editor** — let users set/customize their client seed before betting | Player agency = trust |
| 7.3 | **Server seed hash display** — show hash before bet, reveal after round/bet | Core provably-fair UX pattern |
| 7.4 | **One-click verify** after every bet — pre-filled modal from bet result data | Eliminates manual copy-paste |
| 7.5 | **Fairness education** — 3-step visual explainer: "We commit hash → You set seed → Outcome is verifiable" | Newcomers don't understand provably fair |
| 7.6 | **On-chain badge clarity** — when on-chain mode active, show what's on-chain vs. off-chain per action | Reduces confusion in hybrid mode |
| 7.7 | **Program ID + treasury links** — already on landing; also show in-game footer bar | Persistent trust signal |
| 7.8 | **Bet history → verify links** — every past bet in history has "Verify" action | Audit trail |

---

### Phase 8 — Mobile & Responsive UX (Week 4)

| # | Task | Why |
|---|------|-----|
| 8.1 | **Reduce bottom nav to 5 items** — merge Profile into Wallet or More; industry max is 5 | Current 6 items (incl. More) crowds icons |
| 8.2 | **Bottom sheet pattern** for chat, live bets, bet history, fairness | Reachable without scrolling |
| 8.3 | **Sticky game action bar** — bet amount + primary action always visible above nav | Never scroll to bet |
| 8.4 | **Haptic feedback** on cash-out, win, loss (where supported) | Micro-interactions build confidence |
| 8.5 | **Landscape mode** for Crash — chart full-width, controls on side | Tablet/laptop users |
| 8.6 | **PWA manifest + install prompt** — "Add to Home Screen" for app-like experience | Mobile-first retention |
| 8.7 | **Performance budget** — LCP < 2.5s, 60fps animations, lazy-load non-critical panels | Mobile users churn on slow load |
| 8.8 | **Safe-area audit** — verify all fixed elements respect `env(safe-area-inset-*)` on notched devices | Already partially done; needs full audit |

---

### Phase 9 — Social, Engagement & Retention (Week 4–5)

| # | Task | Why |
|---|------|-----|
| 9.1 | **Surface leaderboard** — move from "More" to primary nav or game sidebar | Social proof drives play |
| 9.2 | **Tournament widget** — persistent prize pool + countdown banner on game pages | Urgency + competition |
| 9.3 | **Win feed improvements** — show game icon, multiplier, relative time; tap to see bet | Already exists; needs polish |
| 9.4 | **Chat UX** — emoji reactions, @mentions, bet share cards ("I cashed out at 5.2×!") | Community retention |
| 9.5 | **Player profile stats** — total wagered, biggest win, favorite game, win rate | Personalization |
| 9.6 | **Hotkeys / achievements** — "First 10× cashout", "100 flips", etc. | Gamification without clutter |
| 9.7 | **Referral system UI** — share link, track referrals, bonus display | Growth loop |

---

### Phase 10 — Performance & Technical UX (Week 5)

| # | Task | Why |
|---|------|-----|
| 10.1 | **WebSocket reconnection UX** — show "Reconnecting…" banner, queue bets, sync state on reconnect | Crash players lose trust on disconnect |
| 10.2 | **Error boundaries per game** — already exist; add user-friendly retry UI | Graceful degradation |
| 10.3 | **Loading skeletons** for all game panels | Perceived performance |
| 10.4 | **Sound system upgrade** — separate volume controls per category (SFX, music, UI); fix coinflip loss sound | Polish |
| 10.5 | **Canvas performance** for CrashChart — requestAnimationFrame throttle, offscreen buffer | Smooth on low-end devices |
| 10.6 | **Code-split game bundles** — ensure each game loads < 100kb gzipped initial | Fast tab switching |

---

### Phase 11 — Testing & Quality Assurance (Ongoing)

| # | Task | Why |
|---|------|-----|
| 11.1 | **Playwright E2E for each game** — place bet, see result, verify fairness link | Currently zero game E2E |
| 11.2 | **Visual regression tests** — screenshot comparison for game states | Catch UI breaks |
| 11.3 | **Component unit tests** — BetAmountControls, AutoCashoutControl, limboSlider math | Regression safety |
| 11.4 | **Mobile device matrix** — iPhone SE, iPhone 15, Pixel, iPad | Thumb-zone validation |
| 11.5 | **Load testing** — 100+ concurrent crash players | WebSocket stability |
| 11.6 | **Accessibility audit** — WCAG 2.1 AA: contrast, focus rings, screen reader labels | Legal + inclusive |

---

### Phase 12 — Landing & Marketing Pages (Week 5–6)

| # | Task | Why |
|---|------|-----|
| 12.1 | **Hero redesign** — embed live Crash spectator in hero (not just text "Crash. Limbo") | Show, don't tell |
| 12.2 | **Game preview cards** — hover/tap to see animated preview of each game | Conversion |
| 12.3 | **Social proof section** — total volume, players online, biggest win today | Trust |
| 12.4 | **Comparison table** — Orbit vs. traditional casinos (speed, fairness, custody) | Education |
| 12.5 | **SEO meta + OG images** per game route | Discoverability |
| 12.6 | **Fix title typo** — live site shows "Crash.Limbo" (missing space/Flip) | Brand polish |
| 12.7 | **Contact links** — X [@OrbitSolCasino](https://x.com/OrbitSolCasino), email orbitsolanacasino@gmail.com in footer and support surfaces | Correct support channels |

---

## Priority Matrix

```
                    IMPACT
                 High │  P4 Crash mobile      P7 Fairness modal
                      │  P4 Cash-out button    P2 Guest/demo mode
                      │  P3 Optimistic balance
                      │  P2 Connect modal
                 Low  │  P12 Landing polish   P9 Social features
                      └────────────────────────────────────────
                         Low              High
                              EFFORT
```

**Do first (highest ROI):**
1. Crash mobile layout + cash-out button (Phase 4.2, 4.9)
2. In-game fairness modal (Phase 7.1, 7.4)
3. Guest/demo spectator mode (Phase 2.1)
4. Connect modal unification (Phase 2.3, 2.4)
5. Optimistic balance + tx status (Phase 3.1, 3.2)
6. Clean URL routing (Phase 1.7)

---

## Competitive Benchmark Targets

| Feature | SolPump | Rugs.fun | Stake | Orbit (current) | Orbit (target) |
|---------|---------|----------|-------|-----------------|----------------|
| Guest game view | Yes | Yes | Yes | Yes (spectator) | Yes |
| Non-custodial bet | Yes | Deposit model | N/A | No (deposit-first) | Optional mode |
| Inline fairness verify | Yes | Yes (/verify) | Yes | In-game modal | + public /verify |
| Crash dual bet | Yes | — | Yes | Single | Dual |
| Crash rocket/visual | Yes | Candlestick | Yes | Rocket FX v2 | + rug skin option |
| Hourly airdrop | Yes | Partial | — | No | Yes |
| XP / crates / daily case | Partial | Yes | — | No | Yes |
| Auto-bet strategies | Yes | — | Yes | Auto-cashout only | Full |
| Client seed control | Yes | No | Yes | Backend only | User-facing |
| Token earn loop | $SOLPUMP | — | — | Pump launch only | Wager rewards |
| Mobile thumb-zone CTAs | Yes | Yes | Yes | Partial | Full |
| Tx status tracking | On-chain | Basic | Yes | Basic toasts | Rich banners |

---

## Estimated Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1–2 | 2 weeks | Design system + onboarding + routing |
| 3–4 | 2 weeks | Wallet flows + Crash perfection |
| 5–6 | 1.5 weeks | Limbo + Coinflip perfection |
| 7–8 | 1.5 weeks | Trust UX + mobile overhaul |
| 9–10 | 1.5 weeks | Social, performance |
| 11–12 | 1 week | Testing + landing polish |
| **Total** | **~9 weeks** | Production-grade UX |

---

## Summary

Orbit Solana Casino has a solid technical foundation — three working games, provably-fair backend, on-chain integration, and a cohesive visual identity. The gap is **UX maturity**: the product needs to feel as fast, transparent, and thumb-friendly as Stake or Shuffle, with fairness surfaced at the moment of play, crash optimized for split-second decisions, and wallet flows that never leave the user guessing.

This plan is **60 specific tasks** across **12 phases**. Start with **Crash mobile + cash-out**, **in-game fairness modal**, and **guest demo mode** — those three changes alone will dramatically improve first impressions and retention.
