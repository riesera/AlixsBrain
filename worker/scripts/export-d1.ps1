$ErrorActionPreference = "Stop"
$wrangler = Join-Path $PSScriptRoot "..\node_modules\.bin\wrangler.cmd"
$backupDirectory = Join-Path $PSScriptRoot "..\backups"
if (-not (Test-Path -LiteralPath $wrangler)) { throw "Run npm install in the worker directory first." }
if (-not (Test-Path -LiteralPath $backupDirectory)) {
    New-Item -ItemType Directory -Path $backupDirectory | Out-Null
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$output = Join-Path $backupDirectory "alixsbrain-$timestamp.sql"
& $wrangler d1 export DB --remote --output $output
if ($LASTEXITCODE -ne 0) { throw "D1 export failed." }

$file = Get-Item -LiteralPath $output
if ($file.Length -eq 0) { throw "D1 export produced an empty file." }
Write-Host "Backup created: $($file.FullName)"
Write-Host "Size: $($file.Length) bytes"
Write-Warning "This SQL file contains capture text. Keep it private."
