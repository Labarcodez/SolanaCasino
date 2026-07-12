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

- Each panel can run **independent auto-bet** with stop profit/loss and round limits ✅



### [Rugs.fun](https://rugs.fun/) — patterns we adopt vs skip



| Capability | Rugs.fun | Orbit |

|------------|----------|-------|

| Chart | Candlestick rug | Classic crash + rocket (our identity) |

| Retention | XP, RugPass, crates | **Skip** — VIP/affiliate/tournament |

| Verify | Public `/verify` | `/verify` → fairness panel ✅ |

| Fairness | Server seed + game ID | Same — no user client seeds |



---



## Build tiers (revised)



**Tier 1 — Ship next** ✅ Complete

1. ~~**Dual bet panel**~~ ✅ Bet A / Bet B with independent auto-cashout

2. ~~**Crash power UX**~~ ✅ PnL card, cashing out state, shortcuts, auto line on chart

3. ~~**WebSocket reconnect banner**~~ ✅

4. ~~**Optimistic balance + tx status banners**~~ ✅ Pending → Confirming + Solscan link

5. ~~**Unified connect modal**~~ ✅ Phantom / Google / Apple + sign-in step + Escape dismiss

6. ~~**Public `/verify` route**~~ ✅ alias to fairness panel



**Tier 2 — Core depth** ✅ Complete

7. ~~**Auto-bet strategies**~~ ✅ stop profit/loss, N rounds on **Bet A + Bet B**

8. ~~**Transaction history UI**~~ ✅ filterable bets/deposits/withdrawals + verify links

9. ~~**Landing hero**~~ ✅ embedded live crash spectator

10. ~~**Mobile crash layout**~~ ✅ chat/bets bottom sheets on mobile



**Tier 3 — Optional** ✅ Mostly complete

11. ~~**Jackpot / pooled rounds**~~ ✅ 0.5% crash bet contributions, high-crash pool payout

12. Optional rug-style chart skin (visual only) — **skipped** (classic rocket chart kept)

13. ~~**Pump.fun token display**~~ ✅ live curve progress, market cap, metadata



### Explicitly out of scope



- User-editable client seeds

- Direct wallet / non-custodial per-bet betting

- XP / levels / battle pass / crates / daily case

- Hourly chat airdrops

- Gamification achievements



---



## Current state (Jul 2026 overhaul pass)



### Strong

- Three games + provably-fair backend + hybrid on-chain

- Guest spectator (crash, limbo, coinflip), clean URLs, in-game fairness modal

- **Dual crash bet** with **per-slot auto-bet** (A + B), rocket chart FX, focus mode

- **Crash round stats** — 1h high multiplier + live round duration

- VIP rakeback + **progress bar**, affiliate, tournament + **your-rank highlight**

- Trust: tx verify links, footer RTPs, chat display names

- SEO: per-route meta/canonical, `og-image.png` (1200×630), sitemap includes wallet/profile

- Sound volume slider + reduced-motion ambient background

- **30+ E2E tests**



### Done (Jul 2026 — research-driven polish)

- ~~Transaction history verify links~~ ✅

- ~~Guest Limbo/Coinflip spectator~~ ✅

- ~~Limbo gauge + recent rolls~~ ✅

- ~~Coinflip polish~~ ✅ reduced-motion coin, payout preview, haptics

- ~~Mobile nav game discovery~~ ✅ Limbo + Flip in primary bar

- ~~Trust footer RTP~~ ✅

- ~~Chat social polish~~ ✅ display names, timestamps, jump-to-bottom

- ~~Crash chart perf~~ ✅ tab-hidden pause, smooth curve interpolation

- ~~Crash history layout~~ ✅ 10 pills single row

- ~~Bet B auto-bet~~ ✅ independent A/B auto-bet panels

- ~~VIP progress bar~~ ✅ profile panel

- ~~Leaderboard/tournament self row~~ ✅ “You” badge when connected

- ~~Sound volume control~~ ✅ persisted 0–100% slider

- ~~Reduced-motion background~~ ✅ static ambient when `prefers-reduced-motion`

- ~~Connect modal Escape~~ ✅ keyboard dismiss

- ~~SEO pass~~ ✅ dynamic meta, og:image, sitemap `/wallet` `/profile`



### Remaining gaps (prioritized)



| Priority | Item | Notes |

|----------|------|-------|

| **P0** | HTTPS custom domain for Phantom social login | Checklist in `docs/PHANTOM-PROD.md` |
| **P0** | Post-deploy production smoke | ✅ `verify-production.mjs` + Playwright `test:e2e:smoke` |
| **P0** | Limbo min target anti-cheat | ✅ 1.25× floor (server + UI) |

| **P0** | Playwright E2E in CI | ✅ Separate CI job; E2E on port 3098 with helpers enabled |
| **P0** | ~~Auth rate-limit login blocker~~ ✅ JSON 429 responses, relaxed auth limits, safe frontend parsing |
| **P0** | ~~SQLite EFS corruption~~ ✅ DELETE journal mode, auto-recovery, pre-start backups on redeploy |

| **P1** | CSS token consolidation | `index.css` vs `theme.css` split — partial |

| **P1** | Transaction history pagination | ✅ offset/limit API + “Load more” UI |

| **P2** | Limbo/Flip keyboard shortcuts | ✅ Enter to roll; Coinflip H/T + Enter |
| **P2** | Limbo/Flip mobile bottom sheets | ✅ History sheet on mobile; sidebar hidden |
| **P2** | Chat bet-share cards (limbo/flip) | ✅ Socket broadcast + game badge in chat |
| **P2** | Admin player drill-down | ✅ Click player → Activity tab filtered by wallet |
| **P3** | Modal focus trap | ✅ Connect, Profile, Fairness, Crash history, mobile sheets |
| **P3** | `og-image.png` (1200×630) | ✅ Build script + PNG meta tags |

| **P4** | On-chain per-bet paths | Anchor program exists; REST/socket is primary path |

| **P4** | Load tests + monitoring | CloudWatch alarms ✅; `npm run load:test` ✅; Sentry still open |

| **P5** | Layered SFX assets | Procedural WebAudio tones only — no sample pack |



---



## Phase summary (condensed)



| Phase | Focus | Key remaining |

|-------|-------|---------------|

| 1 | Design system | Tokens, CSS split |

| 2 | Onboarding | Portal app ID in prod |

| 3 | Wallet | Tx history pagination |

| 4 | Crash | ✅ Dual bet + auto-bet A/B + round stats |

| 5–6 | Limbo/Coinflip | Keyboard shortcuts, mobile sheets |

| 7 | Trust | ✅ verify links, footer RTP |

| 8 | Mobile | Limbo/Flip sheet parity |

| 9 | Social | Chat bet-share for all games |

| 10 | Perf | ✅ chart pause; sound volume ✅ |

| 11 | QA | CI E2E, load test |

| 12 | Landing | ✅ live hero; SEO ✅ (PNG og asset optional) |



---



## Priority order (next sprint)

1. Deploy latest changes to production (`npm run aws:deploy`)
2. Sentry error tracking (optional DSN in backend env)
3. CSS token consolidation (`index.css` vs `theme.css`)
4. Bundle size — lazy-load pump SDK on token page only
5. Layered SFX sample pack (optional polish)



---



## Competitive benchmark (revised)



| Feature | SolPump | Rugs.fun | Orbit now | Target |

|---------|---------|----------|-----------|--------|

| Deposit-first wallet | — | Yes | Yes | Yes (keep) |

| Dual crash bet | Yes | — | Yes ✅ | Yes |

| Auto-cashout per panel | Yes | — | Yes ✅ | Yes |

| Auto-bet per panel | Partial | — | Yes ✅ | Yes |

| Public verify page | Partial | Yes | `/verify` ✅ | Yes |

| XP/crates/airdrops | Yes | Yes | **No** | **No** |

| Direct wallet bet | Yes | — | **No** | **No** |

| VIP/affiliate/tournament | Partial | Partial | Yes ✅ | Polish UI ✅ |



---



## Summary



Orbit competes on **game feel + trust + deposit UX**, not gamification loops or non-custodial wallet betting. **Jul 2026 deploy live** at orbit-casino.com: limbo 1.25× min, og-image PNG, admin analytics, mobile sheets, **mobile layout polish + Phantom browse deeplink connect**, cross-game chat shares, prod verify/smoke tooling. Next ops: follow **`docs/OPS-CHECKLIST.md`** (Phantom Portal App ID, Sentry DSNs, SNS email confirm). Code ready: Secrets Manager injection, treasury insolvency bet gate, withdraw finalizer, honest Landing/guest wallet.

