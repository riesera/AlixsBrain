# AlixsBrain capture Worker

This Worker accepts authenticated Telegram webhook updates and stores them in
Cloudflare D1. Every message creates an Inbox item immediately while preserving
the original raw text. Classification remains manual through the authenticated
responsive dashboard.

## Local development

Requirements: Node.js LTS and npm.

```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
npm run db:migrate:local
npm test
npm run dev
```

Replace both placeholder values in `.dev.vars`. This file is ignored by Git.

The webhook endpoint is `POST /telegram/webhook`. Telegram's
`X-Telegram-Bot-Api-Secret-Token` header must match
`TELEGRAM_WEBHOOK_SECRET`, and the message sender must match
`ALLOWED_TELEGRAM_USER_ID`. `GET /health` is an unauthenticated liveness check
that does not access D1.

## Production prerequisites

1. Authenticate Wrangler with the intended Cloudflare account.
2. Create a D1 database named `alixsbrain`.
3. Replace the placeholder `database_id` in `wrangler.jsonc` with the ID
   returned by Cloudflare.
4. Apply `migrations/0001_initial.sql` to the remote database.
5. Store `TELEGRAM_WEBHOOK_SECRET` and `ALLOWED_TELEGRAM_USER_ID` using
   `wrangler secret put`.
6. Deploy the Worker.

The Telegram bot token is not required by Checkpoint 1 because the Worker does
not call the Telegram API yet. It will be needed when deployment adds bot
confirmation messages and registers the webhook.

After sending the bot a message, securely configure production Telegram access:

```powershell
npm run telegram:configure
```

This prompts for the token with hidden input, discovers the sender ID, stores
the Worker secrets, and registers the production webhook.

Configure dashboard credentials with hidden password prompts:

```powershell
npm run dashboard:configure
```

All dashboard HTML, CSS, JavaScript, and API routes require these credentials.
The Telegram webhook continues to use its independent Telegram secret.

Create a private SQL export of the production D1 database:

```powershell
npm run db:export
```

See `docs/OPERATIONS.md.txt` and `docs/FIELD_TEST.md.txt` for recovery and the
one-week validation procedure.

Never commit `.dev.vars`, bot tokens, or production secret values.
