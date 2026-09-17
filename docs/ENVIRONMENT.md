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
| `VITE_API_URL` | Frontend → API base URL |

Never put secrets in the frontend bundle or git.
