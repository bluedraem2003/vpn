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
| `TELEGRAM_NOTIFY_CHAT_ID` | Optional chat for ops alerts (defaults to `TELEGRAM_CHAT_ID`) |
| `REMINDER_INTERVAL_MS` | Missed-schedule reminder poll interval (default 60000) |
| `IG_SYNC_TICK_MS` | How often the live-page scheduler wakes up (default 300000 = 5 min, min 60000). Each tick syncs at most one due page |
| `IG_SYNC_INTERVAL_MS` | Minimum gap between two automatic syncs of the same page (default 1800000 = 30 min, min 5 min) |
| `IG_SYNC_DISABLED` | `1` = turn off automatic page sync (manual “Sync now” still works) |
| `MEDIA_PROXY_SECRET` | HMAC secret for the signed Instagram media proxy (falls back to `TELEGRAM_WEBHOOK_SECRET`) |
| `INSTAGRAM_SESSION_COOKIE` | Optional Instagram web cookie (`sessionid=`) to reduce public-endpoint throttling. Never required |
| `VITE_API_URL` | Leave empty when UI is same-origin with API |
| `STATIC_DIR` | Optional override for Vite `dist/` folder |

Never put secrets in the frontend bundle or git.

## Auth notes

- Magic / invite links work without SMTP when `SHARE_INVITE_LINKS=1` (default): copy the URL from Team page.
- Disable open `/api/auth/login` in production with `ALLOW_DEV_LOGIN=0`.
