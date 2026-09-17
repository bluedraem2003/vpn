# استقرار روی Render (قدم‌به‌قدم خیلی ساده)

هدف: یک لینک همیشگی مثل `https://postyar.onrender.com` داشته باشی که تو و همکارت باهاش کار کنید.

> نکته صادقانه: پلن Free گاهی خواب می‌رود یا Disk دائمی ندارد. اگر موقع ساخت سرویس Disk نداد، ارزان‌ترین پلن پولی (Starter) را بزن تا دیتابیس پاک نشود.

---

## قبل از شروع این‌ها را آماده کن

1. اکانت GitHub (ریپوی پست‌یار آنجا باشد)
2. این ۴ مقدار از بات تلگرام:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `TELEGRAM_WEBHOOK_SECRET` (یک رمز تصادفی خودت بساز)
3. فایل `render.yaml` در ریپو هست (از قبل اضافه شده)

---

## مرحله ۱ — ورود به Render

1. برو: [https://dashboard.render.com](https://dashboard.render.com)
2. با **GitHub** Sign up / Log in کن
3. دسترسی به ریپوی `vpn` (یا نام ریپوی پست‌یار) را بده

---

## مرحله ۲ — ساخت سرویس از Blueprint

1. در داشبورد Render بزن: **New +** → **Blueprint**
2. ریپوی پست‌یار را انتخاب کن
3. برنچ را بگذار روی برنچی که `render.yaml` دارد (مثلاً `main` بعد از merge، یا همین برنچ deploy)
4. Apply / Apply Blueprint را بزن
5. صبر کن تا سرویس `postyar` ساخته شود

اگر Blueprint ندیدی:
1. **New +** → **Web Service**
2. همان ریپو را وصل کن
3. Runtime را **Docker** بگذار
4. Health Check Path: `/api/health`

---

## مرحله ۳ — Environment Variables

داخل سرویس `postyar` برو → **Environment** و این‌ها را پر کن:

| Key | Value |
|-----|--------|
| `TELEGRAM_BOT_TOKEN` | توکن بات |
| `TELEGRAM_CHAT_ID` | آیدی کانال/گروه |
| `TELEGRAM_WEBHOOK_SECRET` | رمز تصادفی |
| `AUTH_PUBLIC_URL` | آدرس نهایی سایت Render (بعد از ساخته شدن می‌فهمی) |
| `SHARE_INVITE_LINKS` | `1` |
| `ALLOW_DEV_LOGIN` | `0` |
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `HOST` | `0.0.0.0` |
| `DATABASE_PATH` | `/data/postyar.sqlite` |
| `TELEGRAM_API_BASE` | `https://api.telegram.org` |

اول Deploy را یک‌بار بزن تا آدرس سایت مشخص شود، بعد `AUTH_PUBLIC_URL` را درست کن و دوباره Deploy بزن.

آدرس معمولاً شبیه این است:
`https://postyar-xxxx.onrender.com`

پس:
`AUTH_PUBLIC_URL=https://postyar-xxxx.onrender.com`

---

## مرحله ۴ — Disk (خیلی مهم)

در سرویس:
1. بخش **Disks**
2. Mount path: `/data`
3. Size: حداقل `1 GB`

بدون Disk، با هر ری‌استارت اطلاعات پاک می‌شود.

---

## مرحله ۵ — صبر تا سبز شود

1. برو تب **Logs / Events**
2. صبر کن تا Deploy موفق شود
3. این آدرس را باز کن:
   `https://YOUR-APP.onrender.com/api/health`
4. باید چیزی شبیه این ببینی:
   `{"ok":true,"service":"postyar-api",...}`

---

## مرحله ۶ — وصل کردن تلگرام

روی لپ‌تاپ/ترمینال (مقادیر خودت را بگذار):

```bash
export TELEGRAM_BOT_TOKEN="توکن-بات"
export TELEGRAM_WEBHOOK_SECRET="رمز-وبهوک"
export AUTH_PUBLIC_URL="https://YOUR-APP.onrender.com"

curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=$AUTH_PUBLIC_URL/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
  -d 'allowed_updates=["message","channel_post"]'
```

باید `"ok": true` بیاید.

تست: یک عکس به کانال تلگرام بفرست → در اپ برو **دارایی‌ها**.

---

## مرحله ۷ — ورود خودت

1. سایت Render را باز کن
2. ایمیل پیش‌فرض: `owner@postyar.local`
3. بزن **دریافت لینک ورود**
4. لینک را باز کن / کپی و وارد شو

---

## مرحله ۸ — دعوت همکار

1. برو صفحه **تیم**
2. ایمیل واقعی همکار را بنویس
3. نقش را مثلاً `editor` بگذار
4. **ساخت دعوت**
5. **کپی لینک دعوت**
6. لینک را در واتساپ/تلگرام برایش بفرست

همکار لینک را باز کند → وارد همان ورک‌اسپیس می‌شود.

---

## اگر گیر کردی

| مشکل | کار |
|------|-----|
| سایت باز نمی‌شود | Logs را ببین؛ Deploy موفق شده؟ |
| `/api/health` خطا می‌دهد | Envها و `PORT=8080` را چک کن |
| فایل‌ها بعد از چند ساعت نیستند | Disk وصل نیست یا پلن Free داده را نگه نمی‌دارد |
| همکار نمی‌تواند وارد شود | لینک دعوت منقضی شده؛ دوباره دعوت بساز |
| تلگرام فایل نمی‌آورد | Webhook و `TELEGRAM_CHAT_ID` را دوباره چک کن |
| ورود سریع نداری | طبیعی است (`ALLOW_DEV_LOGIN=0`)؛ از Magic Link استفاده کن |

---

## تمام

بعد از این کارها لینک Render همان لینک دائمی تیم شماست. دیگر به تانل Cloudflare نیاز ندارید.
