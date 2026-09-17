# پست‌یار Content Ops

وب‌اپلیکیشن مدیریت تولید محتوا (Instagram-first) با تقویم، گردش وضعیت، دارایی‌ها، تیم و لایهٔ Storage تلگرام.

استودیوی کپشن در مسیر `/studio` حفظ شده است.

## اجرای توسعه

```bash
cp .env.example .env
npm install
npm run dev
```

- وب: `http://localhost:5173`
- API: `http://127.0.0.1:8787`

## اجرای production (یک پورت)

```bash
npm run build
NODE_ENV=production PORT=8080 npm start
```

UI و API هر دو روی همان پورت سرو می‌شوند.

## اشتراک با هم‌تیمی (دائمی)

- راهنمای خیلی سادهٔ Render (پیشنهادی): [docs/RENDER_FA.md](./docs/RENDER_FA.md)
- بقیهٔ گزینه‌ها: [docs/DEPLOY.md](./docs/DEPLOY.md)

خلاصهٔ Docker:

```bash
docker compose up -d --build
```

سپس از صفحهٔ **تیم** همکار را دعوت کنید و لینک ورود را برایش بفرستید.

## مستندات

- [DEPLOY.md](./docs/DEPLOY.md) — استقرار دائمی + دعوت تیم
- [PRODUCT_AUDIT.md](./docs/PRODUCT_AUDIT.md)
- [ENVIRONMENT.md](./docs/ENVIRONMENT.md)
- [TELEGRAM_SETUP.md](./docs/TELEGRAM_SETUP.md)

## تست API

```bash
chmod +x scripts/smoke.sh
./scripts/smoke.sh
```
