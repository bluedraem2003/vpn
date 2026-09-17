# Environment

Copy `.env.example` to `.env` and fill values.

| Variable | Purpose |
|----------|---------|
| `PORT` | Listen port (default `8080` in prod / `8787` in API-only) |
| `HOST` | Bind address (`0.0.0.0` for containers) |
| `NODE_ENV` | `production` enables static hosting + stricter defaults |
| `DATABASE_PATH` | Absolute SQLite path (use `/data/postyar.sqlite` in Docker) |
| `AUTH_PUBLIC_URL` | Public https base for magic/invite links |
| `CORS_ORIGINS` | Extra allowed origins (comma-separated) |
| `SHARE_INVITE_LINKS` | `1` = return invite URLs in API (needed without SMTP) |
| `ALLOW_DEV_LOGIN` | `1` = enable passwordless `/api/auth/login` |
| `TELEGRAM_BOT_TOKEN` | Bot token — server only |
| `TELEGRAM_CHAT_ID` | Allowed channel/group id |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook header secret |
| `TELEGRAM_API_BASE` | Bot API or Local Bot API base |
| `VITE_API_URL` | Leave empty when UI is same-origin with API |
| `STATIC_DIR` | Optional override for Vite `dist/` folder |

Never put secrets in the frontend bundle or git.

## Auth notes

- Magic / invite links work without SMTP when `SHARE_INVITE_LINKS=1` (default): copy the URL from Team page.
- Disable open `/api/auth/login` in production with `ALLOW_DEV_LOGIN=0`.
