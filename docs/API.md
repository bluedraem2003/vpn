# API Reference

Base: same origin as the UI in production (`/api`), `http://127.0.0.1:8787` in dev.

Auth: `Authorization: Bearer <token>` for protected routes. Errors are JSON `{ error, code }`.
Viewers (`role = viewer`) get `403 forbidden` on every non-GET route except `/api/notifications/read`.

## Auth

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/auth/login` | no | Dev quick login. `403 dev_login_off` unless `ALLOW_DEV_LOGIN=1` |
| POST | `/api/auth/owner-key` | no | `{ email, key }` — admin sign-in with `AUTH_OWNER_KEY` |
| POST | `/api/auth/magic-link` | no | Records a login-link request; never returns the URL |
| POST | `/api/auth/magic-link/consume` | no | `{ token }` — one-time, atomic |
| GET | `/api/auth/me` | yes | Current user + workspace + role |
| POST | `/api/auth/logout` | yes | Revoke session |
| GET | `/api/auth/bootstrap` | no | `allowDevLogin`, `ownerKeyEnabled`, public URL |

## Team

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/team` | yes — includes `lastLoginAt` |
| POST | `/api/team/invite` | admin/manager — returns `invite.inviteUrl` when `SHARE_INVITE_LINKS≠0` |
| POST | `/api/team/:userId/login-link` | admin/manager — fresh one-time link for an existing member |
| PATCH | `/api/team/:userId` | admin — `{ role }` (cannot demote the last admin) |
| DELETE | `/api/team/:userId` | admin — removes membership and sessions |

## Pages (connected Instagram pages)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/projects` | yes | Each item carries `igSyncStatus`, `igLastSyncedAt`, `live { followers, posts, engagementRate, … }` |
| POST | `/api/projects` | yes | Saves and does one live fetch; `409 duplicate` if the handle already exists |
| PATCH | `/api/projects/:id` | yes | Changing the handle re-connects |
| POST | `/api/projects/:id/sync` | yes | Manual single-shot sync (6/min). `429 ig_busy` while Instagram cools down |
| DELETE | `/api/projects/:id` | yes | Also removes its notifications |

## Notifications

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/notifications?unread=1&limit=50` | yes — `{ items, unreadCount }` |
| POST | `/api/notifications/read` | yes — `{ ids? , all? }` |
| DELETE | `/api/notifications/:id` | yes |

Kinds: `page_connected`, `new_post`, `followers_up`, `followers_down`, `bio_changed`, `name_changed`, `website_changed`, `privacy_changed`, `post_removed`, `sync_error`.

## Core

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/health` | no |
| GET | `/api/workspaces` | yes |
| GET | `/api/workspaces/:id/dashboard` | yes — includes `pages`, `recentEvents`, `unreadNotifications` |
| GET/POST/PATCH/DELETE | `/api/content` | yes |
| GET | `/api/content/:id/assets` | yes |
| GET/DELETE | `/api/assets` | yes |
| POST | `/api/assets/:id/attach` | yes |
| GET | `/api/assets/:id/download` · `/preview` | yes |
| PATCH | `/api/assets/:id` | yes (tags/status/folder) |
| GET/POST/PATCH/DELETE | `/api/campaigns` | yes |
| GET/POST/DELETE | `/api/ideas` · POST `/api/ideas/:id/convert` | yes |
| GET/POST/DELETE | `/api/occasions` · `/calendar` · `/project-link` | yes |
| GET | `/api/search?q=` | yes |

## Analytics

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/analytics` | yes — workspace production stats |
| GET | `/api/analytics/page?handle=&fresh=1` | yes — public Instagram report; `cached: true` + `staleReason` when serving the last saved report |
| GET | `/api/analytics/connectors` | yes |
| GET | `/api/instagram/search?q=` | yes |
| GET | `/api/instagram/media?url&exp&sig` | signed URL (HMAC, CDN hosts only) |

## Telegram

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/telegram/webhook` | `X-Telegram-Bot-Api-Secret-Token` — refused (503) unless `TELEGRAM_WEBHOOK_SECRET` and `TELEGRAM_CHAT_ID` are set |
| GET | `/api/telegram/status` | yes |
