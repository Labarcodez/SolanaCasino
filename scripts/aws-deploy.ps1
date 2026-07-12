#Requires -Version 7.0
<#
.SYNOPSIS
  Deploy Orbit Solana Casino to AWS ECS Fargate (Docker + persistent SQLite on EFS).

.PREREQUISITES
  - AWS CLI v2: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
  - Docker Desktop (build + push to ECR)
  - aws configure  (or AWS SSO login)
  - backend/.env with secrets

.EXAMPLE
  ./scripts/aws-deploy.ps1 -Region us-east-2 -StackName orbit-casino
#>
param(
  [string]$StackName = "orbit-casino",
  [string]$Region = "us-east-2",
  [string]$ProjectName = "orbit-casino",
  [string]$EnvFile = "backend/.env",
  [switch]$SkipBuild,
  [switch]$SkipInfra
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RepoRoot

function Read-DotEnv {
  param([string]$Path)
  $vars = @{}
  if (-not (Test-Path $Path)) { return $vars }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    $vars[$key] = $val
  }
  return $vars
}

function Require-AwsCli {
  if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "AWS CLI not found. Install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  }
  $identity = aws sts get-caller-identity --output json 2>$null | ConvertFrom-Json
  if (-not $identity) {
    throw "Not logged in. Run: aws configure   or   aws sso login"
  }
  Write-Host "AWS account: $($identity.Account)" -ForegroundColor Cyan
}

function Require-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker not found. Install Docker Desktop for ECR push."
  }
}

Require-AwsCli
$envVars = Read-DotEnv $EnvFile

$jwtSecret = $envVars["JWT_SECRET"]
if ([string]::IsNullOrWhiteSpace($jwtSecret) -or $jwtSecret.StartsWith("dev-only-change-in-production")) {
  $jwtSecret = -join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
  Write-Host "Generated JWT_SECRET (save to backend/.env for future deploys)" -ForegroundColor Yellow
}

$paramFile = Join-Path $env:TEMP "orbit-aws-params.json"
@(
  @{ ParameterKey = "ProjectName"; ParameterValue = $ProjectName },
  @{ ParameterKey = "JwtSecret"; ParameterValue = $jwtSecret },
  @{ ParameterKey = "AlchemyApiKey"; ParameterValue = ($envVars["ALCHEMY_API_KEY"] ?? "") },
  @{ ParameterKey = "CasinoWalletPrivateKey"; ParameterValue = ($envVars["CASINO_WALLET_PRIVATE_KEY"] ?? "") },
  @{ ParameterKey = "CasinoWalletAddress"; ParameterValue = ($envVars["CASINO_WALLET_ADDRESS"] ?? "3BSEfRdZsZz87EDafo5rcY87uLt6RCbPqQZsmNMxYfcu") },
  @{ ParameterKey = "AdminWallet"; ParameterValue = ($envVars["ADMIN_WALLET"] ?? "") },
  @{ ParameterKey = "SolanaCluster"; ParameterValue = ($envVars["SOLANA_CLUSTER"] ?? "mainnet-beta") },
  @{ ParameterKey = "DomainName"; ParameterValue = ($envVars["AWS_DOMAIN_NAME"] ?? "") },
  @{ ParameterKey = "AcmCertificateArn"; ParameterValue = ($envVars["AWS_ACM_CERTIFICATE_ARN"] ?? "") },
  @{ ParameterKey = "BagsFmApiKey"; ParameterValue = ($envVars["BAGS_FM_API_KEY"] ?? "") },
  @{ ParameterKey = "PhantomAppId"; ParameterValue = ($envVars["PHANTOM_APP_ID"] ?? "") },
  @{ ParameterKey = "SentryDsn"; ParameterValue = ($envVars["SENTRY_DSN"] ?? "") },
  @{ ParameterKey = "AlarmEmail"; ParameterValue = ($envVars["AWS_ALARM_EMAIL"] ?? "orbitsolanacasino@gmail.com") },
  @{ ParameterKey = "OrbitTokenMint"; ParameterValue = ($envVars["ORBIT_TOKEN_MINT"] ?? "") },
  @{ ParameterKey = "BagsFmTokenUrl"; ParameterValue = ($envVars["BAGS_FM_TOKEN_URL"] ?? "") },
  @{ ParameterKey = "OrbitTokenLaunchStatus"; ParameterValue = ($envVars["ORBIT_TOKEN_LAUNCH_STATUS"] ?? "coming_soon") },
  @{ ParameterKey = "OrbitTokenLaunchPlatform"; ParameterValue = ($envVars["ORBIT_TOKEN_LAUNCH_PLATFORM"] ?? "pump") },
  @{ ParameterKey = "OrbitTokenDeprecatedMints"; ParameterValue = ($envVars["ORBIT_TOKEN_DEPRECATED_MINTS"] ?? "F2Kg2sH7q8CbH14ouZySE41vtwoJTbiuYCWeppR7BAGS,4T4seM2KAyQ23yF6aqnQHWiuGkuAp22FSs4fNbGPBAGS") }
) | ConvertTo-Json | Set-Content -Path $paramFile -Encoding UTF8

if (-not $SkipInfra) {
  Write-Host "Deploying AWS infrastructure (ECS + EFS + ALB + ECR)..." -ForegroundColor Cyan
  aws cloudformation deploy `
    --template-file aws/cloudformation.yaml `
    --stack-name $StackName `
    --parameter-overrides file://$paramFile `
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM `
    --region $Region `
    --no-fail-on-empty-changeset

  Write-Host "Stack deployed." -ForegroundColor Green
}

$outputs = aws cloudformation describe-stacks `
  --stack-name $StackName `
  --region $Region `
  --query "Stacks[0].Outputs" `
  --output json | ConvertFrom-Json

$ecrUri = ($outputs | Where-Object { $_.OutputKey -eq "EcrRepositoryUri" }).OutputValue
$lbUrl = ($outputs | Where-Object { $_.OutputKey -eq "LoadBalancerUrl" }).OutputValue
$cluster = ($outputs | Where-Object { $_.OutputKey -eq "EcsClusterName" }).OutputValue
$service = ($outputs | Where-Object { $_.OutputKey -eq "EcsServiceName" }).OutputValue

Write-Host "ECR: $ecrUri" -ForegroundColor Green
Write-Host "URL: $lbUrl" -ForegroundColor Green

if (-not $SkipBuild) {
  Require-Docker
  Write-Host "Building and pushing Docker image to ECR..." -ForegroundColor Cyan
  $env:AWS_REGION = $Region
  $env:AWS_DEFAULT_REGION = $Region
  node scripts/aws-build.mjs $ecrUri latest

  Write-Host "Rolling ECS service to new image..." -ForegroundColor Cyan
  aws ecs update-service `
    --cluster $cluster `
    --service $service `
    --force-new-deployment `
    --region $Region `
    --output text | Out-Null
}

Write-Host ""
Write-Host "Waiting for health check..." -ForegroundColor Cyan
$healthUrl = "$lbUrl/api/health"
$healthy = $false
for ($i = 1; $i -le 12; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 15
    if ($resp.Content -match '"status"\s*:\s*"(ok|degraded)"') {
      $healthy = $true
      Write-Host "Health check passed ($i/12)" -ForegroundColor Green
      break
    }
  } catch {
    Write-Host "Waiting for ECS tasks... ($i/12)" -ForegroundColor Yellow
  }
  Start-Sleep -Seconds 15
}
if (-not $healthy) {
  Write-Host "Health check did not pass — run: node scripts/verify-production.mjs $lbUrl" -ForegroundColor Red
} else {
  Write-Host "Running production verify..." -ForegroundColor Cyan
  node scripts/verify-production.mjs $lbUrl
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Production verify reported failures — check ECS logs." -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Deploy complete." -ForegroundColor Green
Write-Host "Health: $lbUrl/api/health" -ForegroundColor Yellow
Write-Host "Config: $lbUrl/api/config" -ForegroundColor Yellow
Write-Host "SQLite persists on EFS at /app/backend/data — survives redeploys." -ForegroundColor Yellow
Write-Host "Backups: /app/backend/data/backups (pre-start + corrupt archives)" -ForegroundColor Yellow
Write-Host "Ops log: /app/backend/data/ops.log (also in CloudWatch /ecs/orbit-casino)" -ForegroundColor Yellow
