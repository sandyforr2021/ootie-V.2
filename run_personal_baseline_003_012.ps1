[CmdletBinding()]
param(
  [switch]$Execute,
  [Parameter(Mandatory = $true)]
  [string]$TargetProjectName,
  [string]$LogDirectory = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$baseline = Join-Path $root 'supabase\personal_baseline'
$manifestPath = Join-Path $root 'SUPABASE_BASELINE_EXECUTION_MANIFEST.md'
$files = @(
  '003_ootie_clothing_items.sql',
  '004_ootie_ootd_posts.sql',
  '005_ootie_sos_posts.sql',
  '006_ootie_outfit_suggestions.sql',
  '007_ootie_auxiliary.sql',
  '008_ootie_bookmarks.sql',
  '009_functions.sql',
  '010_triggers.sql',
  '011_rls_policies.sql',
  '012_storage.sql'
)

if ($TargetProjectName -cne 'OOTIE-sandy-dev') {
  throw 'TargetProjectName must be exactly OOTIE-sandy-dev. Team and other projects are refused.'
}

Write-Host 'This helper is prepared for OOTIE-sandy-dev only.'
Write-Host 'It never runs 001 or 002 and never reads a password from a file.'
$typedTarget = Read-Host 'Type OOTIE-sandy-dev to confirm the visible Dashboard target'
if ($typedTarget -cne 'OOTIE-sandy-dev') {
  throw 'Target confirmation failed. No SQL was started.'
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw
$sourceRows = @()
foreach ($name in $files) {
  $path = Join-Path $baseline $name
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Missing execution source: $name"
  }
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToUpperInvariant()
  $escapedName = [regex]::Escape($name)
  $escapedHash = [regex]::Escape($hash)
  $manifestPattern = '(?m)^\|\s*`?' + $escapedName + '`?\s*\|\s*`' + $escapedHash + '`\s*\|\s*$'
  if ($manifest -notmatch $manifestPattern) {
    throw "Manifest hash mismatch or missing manifest row: $name"
  }
  $sourceRows += [pscustomobject]@{ Name = $name; Path = $path; Hash = $hash }
}

if (-not $Execute) {
  Write-Host 'DRY RUN ONLY: sources and manifest hashes validated; no psql process started.'
  $sourceRows | Format-Table Name, Hash -AutoSize
  exit 0
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  throw 'psql was not found. Install/verify PostgreSQL client tools manually; this helper does not install tools.'
}
if ([string]::IsNullOrWhiteSpace($env:OOTIE_PERSONAL_DATABASE_URL)) {
  throw 'Set OOTIE_PERSONAL_DATABASE_URL in the current PowerShell session only. Do not write it to a file.'
}

if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
  $LogDirectory = Join-Path $root 'pre_migration_backup\batch_execution_logs'
}
New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$summaryPath = Join-Path $LogDirectory "batch-$runId.summary.log"
Add-Content -LiteralPath $summaryPath -Value "TARGET=OOTIE-sandy-dev"
Add-Content -LiteralPath $summaryPath -Value "RUN_ID=$runId"

foreach ($source in $sourceRows) {
  $started = Get-Date
  $logPath = Join-Path $LogDirectory ("$runId-$($source.Name).log")
  Add-Content -LiteralPath $summaryPath -Value "START file=$($source.Name) hash=$($source.Hash) time=$started"
  & $psql.Source -X -v ON_ERROR_STOP=1 -W -d $env:OOTIE_PERSONAL_DATABASE_URL -f $source.Path *> $logPath
  $exitCode = $LASTEXITCODE
  $ended = Get-Date
  Add-Content -LiteralPath $summaryPath -Value "END file=$($source.Name) exit=$exitCode time=$ended log=$logPath"
  if ($exitCode -ne 0) {
    throw "Migration failed: $($source.Name). Batch stopped. Review $logPath; no later file was started."
  }
  Write-Host "PASS $($source.Name)"
}

Write-Host "All ten files completed. Review $summaryPath and then run FINAL_BASELINE_AFTER_CHECK.sql manually."
