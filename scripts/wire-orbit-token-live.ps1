# Wire a newly launched ORBIT mint to production (coming_soon -> live).
# Usage: pwsh -File scripts/wire-orbit-token-live.ps1 -Mint <MINT_ADDRESS> [-Platform pump|bags]

param(
  [Parameter(Mandatory = $true)]
  [string]$Mint,
  [ValidateSet("pump", "bags")]
  [string]$Platform = "pump"
)

$ErrorActionPreference = "Stop"
$envFile = Join-Path $PSScriptRoot "..\backend\.env"
if (-not (Test-Path $envFile)) {
  throw "backend/.env not found"
}

$content = Get-Content $envFile -Raw

function Set-OrAddEnvLine([string]$text, [string]$key, [string]$value) {
  $pattern = "(?m)^$([regex]::Escape($key))=.*$"
  $line = "$key=$value"
  if ($text -match $pattern) {
    return [regex]::Replace($text, $pattern, $line)
  }
  return ($text.TrimEnd() + "`n$line`n")
}

function Remove-EnvLine([string]$text, [string]$key) {
  $pattern = "(?m)^$([regex]::Escape($key))=.*\r?\n?"
  return [regex]::Replace($text, $pattern, "")
}

$content = Set-OrAddEnvLine $content "ORBIT_TOKEN_MINT" $Mint
$content = Set-OrAddEnvLine $content "ORBIT_TOKEN_LAUNCH_STATUS" "live"
$content = Set-OrAddEnvLine $content "ORBIT_TOKEN_LAUNCH_PLATFORM" $Platform

if ($Platform -eq "bags") {
  $bagsUrl = "https://bags.fm/$Mint"
  $content = Set-OrAddEnvLine $content "BAGS_FM_TOKEN_URL" $bagsUrl
} else {
  $content = Set-OrAddEnvLine $content "BAGS_FM_TOKEN_URL" ""
}

Set-Content -Path $envFile -Value ($content.TrimEnd() + "`n") -NoNewline
Write-Host "Updated backend/.env:" -ForegroundColor Green
Write-Host "  ORBIT_TOKEN_MINT=$Mint"
Write-Host "  ORBIT_TOKEN_LAUNCH_PLATFORM=$Platform"
Write-Host "  ORBIT_TOKEN_LAUNCH_STATUS=live"
if ($Platform -eq "bags") {
  Write-Host "  BAGS_FM_TOKEN_URL=https://bags.fm/$Mint"
}
Write-Host ""
Write-Host "Deploy to production: npm run aws:deploy" -ForegroundColor Cyan
