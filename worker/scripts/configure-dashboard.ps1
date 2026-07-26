$ErrorActionPreference = "Stop"
$wrangler = Join-Path $PSScriptRoot "..\node_modules\.bin\wrangler.cmd"
if (-not (Test-Path -LiteralPath $wrangler)) { throw "Run npm install in the worker directory first." }

$username = Read-Host "Dashboard username [alix]"
if ([string]::IsNullOrWhiteSpace($username)) { $username = "alix" }
if ($username.Contains(":")) { throw "The username cannot contain a colon." }

$first = Read-Host "Choose a dashboard password (input is hidden)" -AsSecureString
$second = Read-Host "Enter the password again" -AsSecureString
$firstPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
$secondPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
$password = $null
$confirmation = $null

try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPointer)
    $confirmation = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondPointer)
    if ($password -cne $confirmation) { throw "The passwords did not match. No secrets were changed." }
    if ($password.Length -lt 12) { throw "Use a password containing at least 12 characters." }

    $username | & $wrangler secret put DASHBOARD_USERNAME
    if ($LASTEXITCODE -ne 0) { throw "Failed to store DASHBOARD_USERNAME." }
    $password | & $wrangler secret put DASHBOARD_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw "Failed to store DASHBOARD_PASSWORD." }

    Write-Host "Dashboard credentials configured."
    Write-Host "Username: $username"
    Write-Host "Password was stored securely and was not printed."
}
finally {
    $password = $null
    $confirmation = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPointer)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPointer)
}
