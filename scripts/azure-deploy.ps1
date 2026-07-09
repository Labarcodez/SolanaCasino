#Requires -Version 7.0
<#
.SYNOPSIS
  Deploy Orbit Solana Casino to Azure App Service (Docker + persistent SQLite on Azure Files).

.PREREQUISITES
  - Azure CLI: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows
  - Docker not required locally (image builds in Azure Container Registry)
  - az login
  - backend/.env with secrets (JWT_SECRET, ALCHEMY_API_KEY, CASINO_WALLET_PRIVATE_KEY, etc.)

.EXAMPLE
  ./scripts/azure-deploy.ps1 -ResourceGroup orbit-rg -Location eastus
#>
param(
  [string]$ResourceGroup = "orbit-casino-rg",
  [string]$Location = "eastus",
  [string]$NamePrefix = "orbitcasino",
  [string]$EnvFile = "backend/.env",
  [switch]$SkipBuild
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

function Require-AzCli {
  if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw "Azure CLI not found. Install: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows"
  }
  $account = az account show 2>$null | ConvertFrom-Json
  if (-not $account) {
    throw "Not logged in. Run: az login"
  }
  Write-Host "Azure subscription: $($account.name)" -ForegroundColor Cyan
}

Require-AzCli
$envVars = Read-DotEnv $EnvFile

$jwtSecret = $envVars["JWT_SECRET"]
if ([string]::IsNullOrWhiteSpace($jwtSecret) -or $jwtSecret.StartsWith("dev-only-change-in-production")) {
  $jwtSecret = -join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
  Write-Host "Generated JWT_SECRET (save to backend/.env for future deploys)" -ForegroundColor Yellow
}

$params = @{
  location              = $Location
  namePrefix            = $NamePrefix
  jwtSecret             = $jwtSecret
  alchemyApiKey         = ($envVars["ALCHEMY_API_KEY"] ?? "")
  casinoWalletPrivateKey = ($envVars["CASINO_WALLET_PRIVATE_KEY"] ?? "")
  casinoWalletAddress   = ($envVars["CASINO_WALLET_ADDRESS"] ?? "C9W7nGv2ZBJp4zcmtvBHkrtTPhB1FQ7JaNNPRNhiA4Ze")
  adminWallet           = ($envVars["ADMIN_WALLET"] ?? "")
  solanaCluster         = ($envVars["SOLANA_CLUSTER"] ?? "mainnet-beta")
  brandName             = ($envVars["BRAND_NAME"] ?? "Orbit Solana Casino")
}

Write-Host "Creating resource group $ResourceGroup ($Location)..." -ForegroundColor Cyan
az group create --name $ResourceGroup --location $Location --output none

$paramFile = Join-Path $env:TEMP "orbit-azure-params.json"
@{
  "`$schema" = "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#"
  contentVersion = "1.0.0.0"
  parameters = @{
    location = @{ value = $params.location }
    namePrefix = @{ value = $params.namePrefix }
    jwtSecret = @{ value = $params.jwtSecret }
    alchemyApiKey = @{ value = $params.alchemyApiKey }
    casinoWalletPrivateKey = @{ value = $params.casinoWalletPrivateKey }
    casinoWalletAddress = @{ value = $params.casinoWalletAddress }
    adminWallet = @{ value = $params.adminWallet }
    solanaCluster = @{ value = $params.solanaCluster }
    brandName = @{ value = $params.brandName }
  }
} | ConvertTo-Json -Depth 5 | Set-Content $paramFile -Encoding UTF8

Write-Host "Deploying Azure infrastructure (App Service + ACR + persistent storage)..." -ForegroundColor Cyan
$deployment = az deployment group create `
  --resource-group $ResourceGroup `
  --template-file azure/main.bicep `
  --parameters "@$paramFile" `
  --query properties.outputs `
  --output json | ConvertFrom-Json

Remove-Item $paramFile -Force -ErrorAction SilentlyContinue

$acrName = $deployment.acrName.value
$webAppName = $deployment.webAppName.value
$webAppUrl = $deployment.webAppUrl.value

Write-Host "Web app: $webAppUrl" -ForegroundColor Green
Write-Host "ACR: $acrName" -ForegroundColor Green

if (-not $SkipBuild) {
  Write-Host "Building container image in Azure (this takes a few minutes)..." -ForegroundColor Cyan
  $buildEnv = @{
    SOLANA_CLUSTER = $params.solanaCluster
    CASINO_WALLET_ADDRESS = $params.casinoWalletAddress
    ALCHEMY_API_KEY = $params.alchemyApiKey
    SOLANA_RPC_FALLBACK = "https://solana.drpc.org"
  }
  foreach ($key in $buildEnv.Keys) {
    Set-Item -Path "env:$key" -Value $buildEnv[$key]
  }
  node scripts/azure-build.mjs $acrName "orbit-casino:latest"
}

Write-Host "Restarting web app..." -ForegroundColor Cyan
az webapp restart --resource-group $ResourceGroup --name $webAppName --output none

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "  URL:    $webAppUrl"
Write-Host "  Health: $webAppUrl/api/health"
Write-Host "  Config: $webAppUrl/api/config"
Write-Host ""
Write-Host "Verify withdrawalsEnabled and alchemyConfigured in /api/config after startup." -ForegroundColor Yellow
Write-Host "SQLite persists on Azure Files at /app/backend/data — survives redeploys." -ForegroundColor Yellow
