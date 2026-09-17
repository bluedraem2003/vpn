# Environment

Copy `.env.example` to `.env` and fill values.

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default `8787`) |
| `DATABASE_PATH` | SQLite file path |
| `TELEGRAM_BOT_TOKEN` | Bot token — server only |
| `TELEGRAM_CHAT_ID` | Allowed private channel/group id |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook header secret |
| `TELEGRAM_API_BASE` | Default Bot API or Local Bot API base |
| `AUTH_PUBLIC_URL` | Base URL for magic links (e.g. `http://127.0.0.1:5173`) |
| `VITE_API_URL` | Frontend → API base URL |

Never put secrets in the frontend bundle or git.

## Auth notes

- Magic link works without paid email: in development the link is returned in API response + server logs.
- For production email delivery, hook your mailer to `POST /api/auth/magic-link` without exposing `devMagicUrl`.
