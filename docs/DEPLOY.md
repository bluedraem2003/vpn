# استقرار دائمی پست‌یار (اشتراک با هم‌تیمی)

پست‌یار یک سرور Node واحد است: API + فرانت + SQLite. دو نفر روی یک ورک‌اسپیس با دعوت از صفحهٔ «تیم» کار می‌کنند.

## گزینه ۱ — Docker روی هر VPS (پیشنهادی)

```bash
cp .env.example .env
# TELEGRAM_* و AUTH_PUBLIC_URL=https://YOUR_DOMAIN را پر کنید

docker compose up -d --build
```

یا با ایمیج آماده:

```bash
docker run -d --name postyar -p 8080:8080 \
  -v postyar-data:/data \
  --env-file .env \
  -e DATABASE_PATH=/data/postyar.sqlite \
  ghcr.io/bluedraem2003/postyar:latest
```

سپس دامنه را به پورت `8080` پروکسی کنید (Caddy/Nginx) و webhook تلگرام را بزنید:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=$AUTH_PUBLIC_URL/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

## گزینه ۲ — Render (رایگان/ارزان)

1. ریپو را به [Render](https://render.com) وصل کنید
2. Blueprint از `render.yaml` بسازید
3. Envها را پر کنید (`AUTH_PUBLIC_URL` = آدرس سرویس Render)
4. Disk روی `/data` از قبل در blueprint تعریف شده

## گزینه ۳ — Fly.io

```bash
fly launch --no-deploy   # یا از fly.toml موجود
fly secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... TELEGRAM_WEBHOOK_SECRET=... AUTH_PUBLIC_URL=https://postyar.fly.dev
fly volumes create postyar_data --size 1
fly deploy
```

## دعوت هم‌تیمی

1. ادمین وارد اپ شود
2. **تیم** → ایمیل همکار + نقش → **ساخت دعوت**
3. لینک را کپی و برای همکار بفرستید
4. همکار لینک را باز می‌کند و وارد همان ورک‌اسپیس می‌شود

بدون SMTP لینک‌ها در UI نمایش داده می‌شوند (`SHARE_INVITE_LINKS=1`).

## اشتراک موقت از همین ماشین

```bash
npm run share
```

یک URL روی `trycloudflare.com` می‌سازد (تا وقتی پروسه زنده است). برای کار دائمی از Docker/Render/Fly استفاده کنید.
