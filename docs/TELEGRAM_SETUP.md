# Telegram Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) → copy token → `TELEGRAM_BOT_TOKEN`.
2. Create a **private** channel or group for assets.
3. Add the bot as **admin** (post messages / read messages as needed).
4. Get `chat_id` (forward a post to a debug bot or use getUpdates) → `TELEGRAM_CHAT_ID`.
5. Set a random `TELEGRAM_WEBHOOK_SECRET`.
6. Expose HTTPS (Cloudflare Tunnel / ngrok / public host) to `POST /api/telegram/webhook`.
7. Set webhook:
   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -d "url=https://YOUR_HOST/api/telegram/webhook" \
     -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
   ```
8. Send a test file to the channel → check **دارایی‌ها** in the app.
9. `POST /api/telegram/sync` explains historical sync limits (Bot API cannot fully crawl history).

## Limits (honest)

- Official Bot API download ≈ **20MB**.
- Temporary `file_path` URLs are **never stored**; downloads re-resolve via `getFile`.
- Full historical channel sync needs Local Bot API or re-forwarding files.
