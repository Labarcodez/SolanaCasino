# Deploy to Microsoft Azure

Run Orbit on **Azure App Service (Linux container)** with **GitHub auto-deploy** on every push to `main`.

| Component | Purpose |
|-----------|---------|
| **App Service B1** | Runs Docker container |
| **Azure Container Registry** | Builds image from GitHub |
| **Azure Files** | Persistent SQLite (balances survive redeploys) |
| **GitHub Actions** | `.github/workflows/azure-deploy.yml` |

---

## Option A — Import from GitHub (recommended)

No local Azure CLI required. Do this once in [Azure Portal](https://portal.azure.com).

### Step 1: Deploy infrastructure (one time)

1. Create a resource group: **orbit-casino-rg** (region: **East US**).
2. Search **Deploy a custom template** → **Build your own template in the editor**.
3. Click **Load file** → upload `azure/main.bicep` from this repo  
   (or clone [Labarcodez/SolanaCasino](https://github.com/Labarcodez/SolanaCasino) and upload the file).
4. Click **Save** → **Review + create**.
5. Fill parameters:
   - **jwtSecret** — run `openssl rand -hex 32` or any long random string
   - **alchemyApiKey** — your Alchemy Solana mainnet key
   - **casinoWalletPrivateKey** — treasury wallet private key (base58)
   - **adminWallet** — your Phantom admin pubkey
   - Leave other defaults unless you changed wallets
6. Deploy and wait ~5 minutes. Note the outputs:
   - **webAppName**
   - **acrName**
   - **webAppUrl**

### Step 2: Connect GitHub (Deployment Center)

1. Open the **Web App** resource → **Deployment Center**.
2. Source: **GitHub** → Authorize → select **Labarcodez/SolanaCasino** → branch **main**.
3. Build provider: **GitHub Actions**.
4. Azure may offer to generate a workflow — **use the existing workflow** in the repo:  
   `.github/workflows/azure-deploy.yml`
5. If Azure creates a duplicate workflow, delete it and keep `azure-deploy.yml`.

### Step 3: GitHub repository secrets

In GitHub → **Settings** → **Secrets and variables** → **Actions**, add:

| Secret | Where to get it |
|--------|-----------------|
| `AZURE_CLIENT_ID` | From federated credential setup (Step 4) |
| `AZURE_TENANT_ID` | Azure Portal → Microsoft Entra ID → Overview |
| `AZURE_SUBSCRIPTION_ID` | Azure Portal → Subscriptions |
| `AZURE_RESOURCE_GROUP` | `orbit-casino-rg` |
| `AZURE_WEBAPP_NAME` | Bicep output **webAppName** |
| `AZURE_ACR_NAME` | Bicep output **acrName** (no `.azurecr.io`) |
| `VITE_PHANTOM_APP_ID` | Optional — Phantom Portal app ID |

### Step 4: Enable GitHub → Azure login (OIDC)

In Azure Portal → **Microsoft Entra ID** → **App registrations** → **New registration**:

- Name: `github-orbit-casino`
- Create

Then:

1. **Certificates & secrets** → **Federated credentials** → Add:
   - Entity: **GitHub Actions**
   - Org: `Labarcodez`
   - Repo: `SolanaCasino`
   - Branch: `main`
2. Copy **Application (client) ID** → GitHub secret `AZURE_CLIENT_ID`
3. **Subscriptions** → your subscription → **Access control (IAM)** → **Add role assignment**:
   - Role: **Contributor**
   - Member: the app registration `github-orbit-casino`

### Step 5: Push to deploy

Any push to `main` runs the workflow: build in ACR → deploy → health check.

Or: GitHub → **Actions** → **Deploy to Azure App Service** → **Run workflow**.

### Step 6: Verify

Open `https://YOUR-WEBAPP-NAME.azurewebsites.net/api/config`

Expect: `alchemyConfigured: true`, `withdrawalsEnabled: true`, `clientRpcUrl: https://solana.drpc.org`

---

## Option B — PowerShell script (local CLI)

If you prefer one command from your PC:

```powershell
az login
npm run azure:deploy
```

See [scripts/azure-deploy.ps1](../scripts/azure-deploy.ps1).

---

## App settings (secrets)

Bicep sets initial values. Update anytime:

**Portal** → Web App → **Environment variables**

Important keys: `JWT_SECRET`, `ALCHEMY_API_KEY`, `CASINO_WALLET_PRIVATE_KEY`, `ADMIN_WALLET`, `FRONTEND_URL`

Restart the app after changes.

---

## Redeploy

Automatic on every push to `main`. Manual: GitHub Actions → Run workflow.

---

## Custom domain (later)

1. App Service → **Custom domains**
2. Set `FRONTEND_URL=https://yourdomain.com`
3. Phantom Portal allowlist + DNS CNAME

---

## Migrate from Render

1. Deploy Azure + connect GitHub
2. Test deposit/withdraw on Azure URL
3. Point domain to Azure
4. Disable Render (keep same `CASINO_WALLET_ADDRESS`)

Render SQLite does **not** migrate — use Wallet **“Credit deposit”** for any stuck txs first.

---

## Cost (after free credits)

~**$19/month** (B1 + ACR Basic + storage). Scale App Service plan when traffic grows.

---

## Files

| Path | Purpose |
|------|---------|
| `azure/main.bicep` | Infrastructure template |
| `.github/workflows/azure-deploy.yml` | GitHub → ACR → App Service |
| `scripts/azure-deploy.ps1` | Optional local deploy |
