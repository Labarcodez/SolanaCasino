# Phantom social login — production checklist

Google and Apple sign-in via [Phantom Connect](https://phantom.com/portal) require a **secure context** (HTTPS) and a registered app ID.

## 1. Custom domain + HTTPS

- [ ] Point `orbit-casino.com` (or your domain) at the AWS ALB
- [ ] ACM certificate in **us-east-2** attached via CloudFormation `DomainName` + `AcmCertificateArn`
- [ ] Site loads at `https://orbit-casino.com` (not raw ALB HTTP URL)

## 2. Phantom Portal

- [ ] Create app at [phantom.com/portal](https://phantom.com/portal)
- [ ] Add allowed redirect URL: `https://orbit-casino.com/auth/callback` (and `http://localhost:5173/auth/callback` for dev)
- [ ] Copy **App ID**

## 3. Environment variables

| Where | Variable | Notes |
|-------|----------|--------|
| `backend/.env` | `PHANTOM_APP_ID` | Enables `socialLoginEnabled` in `/api/config` |
| Build / Docker | `VITE_PHANTOM_APP_ID` | Same value — baked into frontend at build time |

Rebuild and redeploy after changing `VITE_PHANTOM_APP_ID` (frontend is static in the image).

## 4. Verify after deploy

```bash
node scripts/verify-production.mjs https://orbit-casino.com
PLAYWRIGHT_BASE_URL=https://orbit-casino.com PLAYWRIGHT_SKIP_WEBSERVER=true npm run test:e2e:smoke
```

Expected:

- `/api/config` → `socialLoginEnabled: true`
- Connect modal shows Google / Apple when HTTPS + app ID are set

## 5. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Extension works, social buttons hidden | Set `PHANTOM_APP_ID` + rebuild with `VITE_PHANTOM_APP_ID` |
| Social login opens then fails | Check redirect URL in Phantom Portal matches production domain |
| "Phantom requires HTTPS" banner | Serve site over HTTPS; extension login needs secure context |
| Works locally, not on ALB URL | Use custom domain with SSL, not `http://*.elb.amazonaws.com` |

Full operator checklist (Portal + Sentry + SNS): **`docs/OPS-CHECKLIST.md`**.
