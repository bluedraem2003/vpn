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

✅ Domain model + SQLite  
✅ API: health, workspaces/dashboard, content CRUD, assets, telegram webhook/status  
✅ UI shell: Dashboard, Calendar, Content, Assets, Telegram, Studio  
⏳ Projects / Campaigns / Team / full Ideas DB / Auth hardening / tests
