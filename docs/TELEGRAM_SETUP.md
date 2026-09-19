# Telegram Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) → copy token → `TELEGRAM_BOT_TOKEN`.
2. Add the bot as **admin** to every private group or channel that should send assets.
3. Set `TELEGRAM_CHAT_ID` to the ops-alerts chat (optional for ingest; used for notifications and to seed the connected-chats list).
4. Set a random `TELEGRAM_WEBHOOK_SECRET`.
5. Expose HTTPS (Cloudflare Tunnel / ngrok / public host) to `POST /api/telegram/webhook`.
6. Set webhook:
   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -d "url=https://YOUR_HOST/api/telegram/webhook" \
     -d "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
     -d 'allowed_updates=["message","channel_post","my_chat_member"]'
   ```
7. Send a test file to a connected group → it should appear on **تلگرام** (group card + file count) and in **دارایی‌ها**.
8. Historical sync is limited: Bot API cannot fully crawl private channel history.

The Telegram page lists groups/channels the bot is in and from which it indexes files. Random private DMs are not ingested.

## Limits (honest)

- Official Bot API download ≈ **20MB**.
- Temporary `file_path` URLs are **never stored**; downloads re-resolve via `getFile`.
- Full historical channel sync needs Local Bot API or re-forwarding files.
- Telegram does not expose a “list all chats” API for bots, so a group appears after the bot sees a message, a membership event, or a configured `TELEGRAM_CHAT_ID`.
