# What you must do by hand (code is ready)

Do these in order. After each section that changes env/Portal, redeploy with:

```powershell
npm run aws:deploy
```

---

## 1. Phantom Portal (Google / Apple login) — required for social pills

1. Open https://phantom.com/portal and sign in.
2. Create or select your app for **Orbit Solana Casino**.
3. Verify domain **orbit-casino.com**.
4. Allowed origins (exact):
   - `https://orbit-casino.com`
   - `http://localhost:5173` (local only)
5. Redirect URLs (exact match, no trailing slash mismatch):
   - `https://orbit-casino.com/auth/callback`
   - `http://localhost:5173/auth/callback`
6. Copy the **App ID**.
7. Put it in `backend/.env`:

```env
PHANTOM_APP_ID=your-app-id-here
VITE_PHANTOM_APP_ID=your-app-id-here
```

(Same value twice — Vite bakes `VITE_*` into the frontend at Docker build time.)

8. Redeploy. Confirm:

```text
https://orbit-casino.com/api/config → "socialLoginEnabled": true
```

Landing should show Google / Apple pills.

Docs: `docs/PHANTOM-PROD.md`

---

## 2. Sentry (error monitoring) — optional but recommended

1. Create a free account at https://sentry.io
2. Create two projects (or one each):
   - **Node / Express** → copy DSN → `SENTRY_DSN=...` in `backend/.env`
   - **React** → copy DSN → `VITE_SENTRY_DSN=...` in `backend/.env` (build reads it) and/or `frontend/.env`
3. Redeploy (frontend DSN only applies after image rebuild).
4. Confirm health: `"sentryEnabled": true` on `/api/health`
5. Trigger a test error in Sentry UI (optional) or wait for a real 500.

---

## 3. CloudWatch email alarms — confirm SNS

Deploy already passes `AWS_ALARM_EMAIL` (defaults to `orbitsolanacasino@gmail.com`).

1. Set in `backend/.env` if you want a different inbox:

```env
AWS_ALARM_EMAIL=you@example.com
```

2. After `npm run aws:deploy`, check that inbox for **AWS Notification - Subscription Confirmation**.
3. Click **Confirm subscription**.
4. Alarms wired: ALB unhealthy hosts, ECS CPU > 85%.

---

## 4. Casino wallet (already unified in code)

Canonical address:

```text
3BSEfRdZsZz87EDafo5rcY87uLt6RCbPqQZsmNMxYfcu
```

In `backend/.env` ensure:

```env
CASINO_WALLET_ADDRESS=3BSEfRdZsZz87EDafo5rcY87uLt6RCbPqQZsmNMxYfcu
CASINO_WALLET_PRIVATE_KEY=<base58 matching that pubkey>
```

Production boot **fails** if the private key is set but does not match the address.

---

## 5. Secrets Manager (automatic on next infra deploy)

Hot secrets (`JWT_SECRET`, wallet key, Alchemy, Bags, Phantom App ID, Sentry DSN) now live in Secrets Manager (`orbit-casino/app`) and are injected into ECS — they no longer appear as plaintext task environment values.

You do not create the secret by hand; `npm run aws:deploy` updates the stack from `backend/.env`.

Verify (optional):

```powershell
aws secretsmanager describe-secret --secret-id orbit-casino/app --region us-east-2
```

---

## 6. GitHub (so CI matches production)

After local commit/push of this work:

1. In GitHub → repo → **Settings → Secrets and variables → Actions**, set at least:
   - `VITE_PHANTOM_APP_ID` (same as Portal)
   - `VITE_CASINO_WALLET` = `3BSEfRdZsZz87EDafo5rcY87uLt6RCbPqQZsmNMxYfcu`
   - `VITE_SENTRY_DSN` (if using frontend Sentry)
2. Do not put the wallet private key in GitHub if you only deploy via local `aws:deploy`.

---

## 7. Redeploy + verify

```powershell
# From repo root, with Docker Desktop running and aws logged in:
npm run aws:deploy

# Then:
node scripts/verify-production.mjs https://orbit-casino.com
```

Checks you care about:

| Check | Expect |
|-------|--------|
| `/api/health` | `status: ok`, `treasurySolvent: true` |
| `/api/config` | `casinoWallet` = `3BSEf…`, `socialLoginEnabled` after Portal |
| Landing | No Google/Apple until Portal App ID is set |
| `/wallet` as guest | Connect CTA (not blank Landing drop) |

---

## Already done in code (no action)

- Unified wallet defaults (`3BSEf…`)
- Honest Landing / guest wallet CTA
- Sentry hooks (env-gated)
- Treasury insolvency bet gate (prod default on)
- Withdrawal finalizer cron (~45s)
- Secrets Manager task injection + SNS alarm hooks
