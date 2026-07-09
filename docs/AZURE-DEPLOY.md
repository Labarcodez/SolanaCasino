# Deploy to Microsoft Azure

Run Orbit on **Azure App Service (Linux container)** with:

- **Azure Container Registry** — builds your Docker image in the cloud (no local Docker required)
- **Azure Files** — persistent SQLite at `/app/backend/data` (balances survive redeploys)
- **B1 App Service plan** — fits free credits; scale up later

## Prerequisites

1. [Azure free account / credits](https://azure.microsoft.com/free/)
2. [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows)
3. `backend/.env` filled in (same secrets as Render):
   - `JWT_SECRET`
   - `ALCHEMY_API_KEY`
   - `CASINO_WALLET_ADDRESS`
   - `CASINO_WALLET_PRIVATE_KEY`
   - `ADMIN_WALLET`

## One-command deploy (Windows)

```powershell
az login
cd C:\Users\William Walker\Desktop\SolanaCasino
./scripts/azure-deploy.ps1 -ResourceGroup orbit-casino-rg -Location eastus
```

The script will:

1. Create the resource group
2. Deploy Bicep (`azure/main.bicep`) — App Service, ACR, storage + file share
3. Build the container in ACR (`scripts/azure-build.mjs`)
4. Restart the web app

When finished, open the URL printed in the terminal (e.g. `https://orbitcasino-xxxxx.azurewebsites.net`).

## Verify

```powershell
curl https://YOUR-APP.azurewebsites.net/api/health
curl https://YOUR-APP.azurewebsites.net/api/config
```

Expect:

- `"status":"ok"`
- `"alchemyConfigured":true`
- `"withdrawalsEnabled":true`
- `"clientRpcUrl":"https://solana.drpc.org"`

## Redeploy after code changes

```powershell
# Rebuild image only (infra already exists)
$acr = az acr list -g orbit-casino-rg --query "[0].name" -o tsv
node scripts/azure-build.mjs $acr orbit-casino:latest
az webapp restart -g orbit-casino-rg -n YOUR_WEB_APP_NAME
```

Or run the full script with `-SkipBuild` skipped (default rebuilds).

## Update secrets

Portal → **App Service** → **Settings** → **Environment variables**

Or CLI:

```powershell
az webapp config appsettings set -g orbit-casino-rg -n YOUR_APP_NAME `
  --settings ALCHEMY_API_KEY="your-key" CASINO_WALLET_PRIVATE_KEY="your-key"
```

Restart the app after changing secrets.

## Custom domain (later)

1. App Service → **Custom domains** → add your domain
2. Update app setting `FRONTEND_URL=https://yourdomain.com`
3. Add the same origin to Phantom Portal allowlist

## Cost (after credits)

| Resource | Approx. monthly |
|----------|-----------------|
| App Service B1 | ~$13 |
| ACR Basic | ~$5 |
| Storage (5 GB file share) | ~$1 |
| **Total** | **~$19/mo** |

Scale up by changing `appServicePlanSku` in Bicep to `S1` or higher when traffic grows.

## Migrate from Render

1. Deploy to Azure (above)
2. Test deposit / withdraw on Azure URL
3. Point your domain to Azure
4. Shut down Render web service (keep treasury wallet — same `CASINO_WALLET_ADDRESS`)

**Note:** Render SQLite data does **not** auto-migrate. Credit any stuck deposits manually via the Wallet recovery UI before switching.

## Files

| Path | Purpose |
|------|---------|
| `azure/main.bicep` | Infrastructure template |
| `azure/parameters.example.json` | Parameter template |
| `scripts/azure-deploy.ps1` | Full deploy script |
| `scripts/azure-build.mjs` | ACR image build |
