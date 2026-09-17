# API Reference

Base: `http://127.0.0.1:8787` (proxied as `/api` in Vite).

Auth: `Authorization: Bearer <token>` for protected routes.

## Auth

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/auth/login` | no | Bootstrap login (`owner@postyar.local`) |
| GET | `/api/auth/me` | yes | Current user + workspace |
| POST | `/api/auth/logout` | yes | Revoke session |
| GET | `/api/auth/bootstrap` | no | Default email hint |

## Core

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/health` | no |
| GET | `/api/workspaces` | yes |
| GET | `/api/workspaces/:id/dashboard` | yes |
| GET/POST/PATCH/DELETE | `/api/content` | yes |
| GET | `/api/content/:id/assets` | yes |
| GET/DELETE | `/api/assets` | yes |
| POST | `/api/assets/:id/attach` | yes |
| GET | `/api/assets/:id/download` | yes |
| GET/POST/PATCH/DELETE | `/api/projects` | yes |
| GET/POST/PATCH/DELETE | `/api/campaigns` | yes |
| GET/POST/DELETE | `/api/ideas` | yes |
| POST | `/api/ideas/:id/convert` | yes |
| GET | `/api/team` | yes |
| GET | `/api/search?q=` | yes |

## Telegram

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/telegram/webhook` | secret header |
| GET | `/api/telegram/status` | no |
| POST | `/api/telegram/sync` | no (returns 501 with honest limitation) |
