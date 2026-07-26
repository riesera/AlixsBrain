# AlixsBrain

AlixsBrain is a small external-brain system for reliable capture, manual organization, and review. Its purpose is to reduce how much information the user must personally remember.

## Deployed V1.1 architecture

```text
Telegram → Cloudflare Worker → Cloudflare D1
                         ↕
              Authenticated dashboard
```

- Telegram provides fast mobile capture and a `Saved.` confirmation.
- One Cloudflare Worker handles the Telegram webhook, authenticated APIs, and responsive static dashboard.
- Cloudflare D1 is the shared source of truth.
- New captures enter Inbox immediately and are categorized manually afterward.
- The dashboard works on phone and desktop without a local computer remaining online.

The Worker project and deployment instructions are under `worker/`.

## V1.1 item model

Items separate a primary work category from optional domain, requester, project, multiple flags, due date/time, and lifecycle status. Status is Inbox, Open, Waiting, Done, or Archived. Raw capture text is preserved independently of later classification.

## Legacy local prototype

`app.py`, `templates/`, and `static/` contain the original Flask/SQLite proof of concept. They remain for historical reference but are not the active deployed application and do not read production D1 data.

## Project documentation

Start with `docs/README.md.txt`. Purpose, decisions, roadmap, current state, field testing, and recovery instructions are maintained under `docs/`.
