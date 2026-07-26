param([string]$WorkerUrl = "https://alixsbrain-capture.alix-98e.workers.dev")

$ErrorActionPreference = "Stop"
$wrangler = Join-Path $PSScriptRoot "..\node_modules\.bin\wrangler.cmd"
if (-not (Test-Path -LiteralPath $wrangler)) {
    throw "Wrangler is not installed locally. Run npm install in the worker directory first."
}

$secureToken = Read-Host "Paste the Telegram bot token (input is hidden)" -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
$botToken = $null

try {
    $botToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
    if ([string]::IsNullOrWhiteSpace($botToken)) { throw "No bot token was provided." }

    $telegramApi = "https://api.telegram.org/bot$botToken"
    $webhookInfo = Invoke-RestMethod -Method Get -Uri "$telegramApi/getWebhookInfo"
    if (-not $webhookInfo.ok) { throw "Telegram did not accept the bot token." }

    if (-not [string]::IsNullOrWhiteSpace([string]$webhookInfo.result.url)) {
        Write-Host "An existing webhook is registered: $($webhookInfo.result.url)"
        $replace = Read-Host "Replace it with AlixsBrain? Type YES to continue"
        if ($replace -cne "YES") { throw "No changes were made." }
        $removed = Invoke-RestMethod -Method Post -Uri "$telegramApi/deleteWebhook" -Body @{ drop_pending_updates = "false" }
        if (-not $removed.ok) { throw "Telegram could not remove the previous webhook." }
    }

    $updates = Invoke-RestMethod -Method Get -Uri "$telegramApi/getUpdates"
    $messageUpdate = @($updates.result | Where-Object { $null -ne $_.message.from.id }) | Select-Object -Last 1
    if ($null -eq $messageUpdate) {
        throw "No Telegram message is waiting. Send the bot a text message, then run this command again."
    }

    $userId = [string]$messageUpdate.message.from.id
    $webhookSecret = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")

    $botToken | & $wrangler secret put TELEGRAM_BOT_TOKEN
    if ($LASTEXITCODE -ne 0) { throw "Failed to store TELEGRAM_BOT_TOKEN." }
    $webhookSecret | & $wrangler secret put TELEGRAM_WEBHOOK_SECRET
    if ($LASTEXITCODE -ne 0) { throw "Failed to store TELEGRAM_WEBHOOK_SECRET." }
    $userId | & $wrangler secret put ALLOWED_TELEGRAM_USER_ID
    if ($LASTEXITCODE -ne 0) { throw "Failed to store ALLOWED_TELEGRAM_USER_ID." }

    $setWebhook = Invoke-RestMethod -Method Post -Uri "$telegramApi/setWebhook" -Body @{
        url = "$WorkerUrl/telegram/webhook"
        secret_token = $webhookSecret
        allowed_updates = '["message"]'
        drop_pending_updates = "false"
    }
    if (-not $setWebhook.ok) { throw "Telegram rejected the webhook: $($setWebhook.description)" }

    $finalInfo = Invoke-RestMethod -Method Get -Uri "$telegramApi/getWebhookInfo"
    Write-Host "Telegram configuration complete."
    Write-Host "Allowed Telegram user ID: $userId"
    Write-Host "Webhook URL: $($finalInfo.result.url)"
    Write-Host "Pending updates: $($finalInfo.result.pending_update_count)"
}
finally {
    $botToken = $null
    if ($tokenPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
    }
}
