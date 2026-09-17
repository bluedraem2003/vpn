# پست‌یار Content Ops

وب‌اپلیکیشن مدیریت تولید محتوا (Instagram-first) با تقویم، گردش وضعیت، دارایی‌ها و لایهٔ Storage تلگرام.

استودیوی کپشن قبلی در مسیر `/studio` حفظ شده است.

## اجرا

```bash
cp .env.example .env
npm install
npm run dev
```

- وب: `http://localhost:5173`
- API: `http://127.0.0.1:8787`

جداگانه:

```bash
npm run dev:web
npm run dev:api
```

## مستندات

- [PRODUCT_AUDIT.md](./docs/PRODUCT_AUDIT.md) — معماری و Plan
- [ENVIRONMENT.md](./docs/ENVIRONMENT.md)
- [TELEGRAM_SETUP.md](./docs/TELEGRAM_SETUP.md)

## فاز فعلی

✅ Domain + SQLite + Auth session  
✅ Content / Calendar / Assets / Telegram webhook  
✅ Ideas (Convert), Projects, Campaigns, Team, Search  
✅ Analytics واقعی + Preview دارایی‌ها + Magic Link auth + Team invite  
⏳ SMTP واقعی / Local Bot API / تقویم drag-drop

## تست سریع API

```bash
chmod +x scripts/smoke.sh
./scripts/smoke.sh
```
