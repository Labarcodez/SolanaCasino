# Deploy to Amazon Web Services (AWS)

Run Orbit on **ECS Fargate (Docker)** with **EFS persistent storage** and **GitHub auto-deploy** on every push to `main`.

| Component | Purpose |
|-----------|---------|
| **ECS Fargate** | Runs Docker container (512 CPU / 1 GB RAM default) |
| **Amazon ECR** | Stores container images |
| **Amazon EFS** | Persistent SQLite — balances survive redeploys |
| **Application Load Balancer** | Public HTTP endpoint |
| **GitHub Actions** | `.github/workflows/aws-deploy.yml` |

**Recommended region for Western Kansas:** `us-east-2` (Ohio)

---

## Remove Azure (if you created resources)

The repo no longer includes Azure config. Delete any Azure resources manually so you are not billed:

1. [Azure Portal](https://portal.azure.com) → **Resource groups**
2. Delete **orbit-casino-rg** (or **orbit casino rg**)
3. Confirm deletion of the Web App, App Service plan, and any storage/ACR created by the import wizard

You can also disable/delete the Azure MCP plugin in Cursor — it is no longer needed for this project.

**Production URL:** http://orbit-casino-alb-737118565.us-east-2.elb.amazonaws.com

---

## Option A — One-command deploy (local CLI)

### Prerequisites

1. [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
2. [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
3. AWS account with permissions for CloudFormation, ECS, ECR, EFS, EC2, ELB, IAM, Logs
4. `backend/.env` with production secrets

### Configure AWS CLI

```powershell
aws configure
# or: aws sso login
```

Default region: **us-east-2**

### Deploy

```powershell
cd "C:\Users\William Walker\Desktop\SolanaCasino"
npm run aws:deploy
```

This will:

1. Deploy `aws/cloudformation.yaml` (VPC, ECR, EFS, ALB, ECS)
2. Build the Docker image locally
3. Push to ECR
4. Roll the ECS service

When finished, open the **HealthCheckUrl** printed in the terminal.

### Verify

```text
http://YOUR-ALB-DNS/api/health
http://YOUR-ALB-DNS/api/config
```

Expect: `"status":"ok"`, `"alchemyConfigured":true`, `"withdrawalsEnabled":true`

**Alchemy** is server-side only — set `ALCHEMY_API_KEY` in `backend/.env` before deploy. The browser does not need an Alchemy key; it uses the RPC URL from `/api/config`.

---

## HTTPS (required for Phantom wallet)

Phantom **will not connect** on plain `http://` except `localhost`. Your AWS ALB URL is HTTP-only until you add a domain and certificate.

### Quick setup

1. Point a domain (Route 53 or your registrar) **CNAME** to your ALB DNS name, e.g. `orbit-casino-alb-737118565.us-east-2.elb.amazonaws.com`
2. AWS Console → **Certificate Manager** (region **us-east-2**) → **Request certificate** for `your-domain.com` (DNS validation)
3. Add the validation CNAME records at your DNS host
4. Add to `backend/.env`:
   ```env
   AWS_DOMAIN_NAME=casino.yourdomain.com
   AWS_ACM_CERTIFICATE_ARN=arn:aws:acm:us-east-2:ACCOUNT:certificate/UUID
   ```
5. Redeploy: `npm run aws:deploy`
6. Open **`https://casino.yourdomain.com`** (not the raw ALB HTTP URL)

The stack redirects HTTP → HTTPS when both env vars are set.

---

## Option B — GitHub Actions (push to deploy)

Use this after Option A created the stack once.

### Step 1 — Deploy infrastructure (one time)

Run Option A locally, **or** deploy the CloudFormation template in AWS Console:

1. AWS Console → **CloudFormation** → **Create stack** → **Upload template**
2. Upload `aws/cloudformation.yaml`
3. Stack name: `orbit-casino`
4. Parameters: copy secrets from `backend/.env`
5. Acknowledge IAM capabilities → **Create stack**

Note stack outputs: **EcrRepositoryUri**, **LoadBalancerUrl**, **EcsClusterName**, **EcsServiceName**

### Step 2 — GitHub OIDC for AWS

1. AWS Console → **IAM** → **Identity providers** → Add **OpenID Connect**
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
2. **IAM** → **Roles** → **Create role** → **Web identity**
   - Identity provider: `token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
   - GitHub org: `Labarcodez`, repo: `SolanaCasino`, branch: `main`
3. Attach policies: `AmazonEC2ContainerRegistryPowerUser`, `AmazonECS_FullAccess` (or a tighter custom policy)
4. Copy the role **ARN**

### Step 3 — GitHub repository secrets

Repo → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Value |
|--------|--------|
| `AWS_ROLE_ARN` | IAM role ARN from Step 2 |
| `AWS_ECR_REPOSITORY` | `orbit-casino` (repo name, not full URI) |
| `AWS_ECS_CLUSTER` | CloudFormation output `EcsClusterName` |
| `AWS_ECS_SERVICE` | CloudFormation output `EcsServiceName` |
| `AWS_LOAD_BALANCER_URL` | CloudFormation output `LoadBalancerUrl` (no trailing slash) |
| `VITE_PHANTOM_APP_ID` | Optional — Phantom Portal app ID |

### Step 4 — Push to deploy

Any push to `main` runs `.github/workflows/aws-deploy.yml`.

Or: GitHub → **Actions** → **Deploy to AWS ECS** → **Run workflow**.

---

## Update secrets / env vars

Environment variables are set in the CloudFormation **TaskDefinition**. To change them:

1. AWS Console → **CloudFormation** → stack `orbit-casino` → **Update**
2. Edit parameters (JWT, Alchemy key, wallet keys, etc.)
3. Or update the task definition in **ECS** → **Task definitions** → create new revision → update service

After changing `FRONTEND_URL` (custom domain), update the stack parameter or task env and redeploy.

---

## HTTPS + custom domain (later)

1. Request a certificate in **ACM** (same region as ALB)
2. Add HTTPS listener on the ALB (port 443)
3. Route 53 or your DNS → CNAME to ALB DNS name
4. Set `FRONTEND_URL=https://yourdomain.com` in the task definition
5. Phantom Portal allowlist → add your domain

---

## Post-migration

Production runs on AWS only. If you still have a Render service from an earlier deploy, delete it in the [Render dashboard](https://dashboard.render.com) so you are not billed or serving two backends.

---

## Cost estimate

Rough monthly (after AWS free tier where applicable):

| Service | ~Cost |
|---------|-------|
| Fargate (1 task, 0.5 vCPU / 1 GB) | ~$15 |
| ALB | ~$16 |
| EFS | ~$1–3 |
| ECR | ~$1 |
| **Total** | **~$33/month** |

Scale `DesiredCount` or task CPU/memory in CloudFormation when traffic grows.

---

## Files

| Path | Purpose |
|------|---------|
| `aws/cloudformation.yaml` | Infrastructure template |
| `aws/parameters.example.json` | Example stack parameters |
| `.github/workflows/aws-deploy.yml` | GitHub → ECR → ECS |
| `scripts/aws-deploy.ps1` | One-command local deploy |
| `scripts/aws-build.mjs` | Build + push to ECR |
| `Dockerfile` | Production container image |
