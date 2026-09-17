# PostYar → Content Ops Platform — Product Audit & Plan

> Generated from codebase audit. No production rewrite of existing Studio without phased migration.

## Snapshot (as of audit)

| Area | Current state |
|------|----------------|
| Framework | Vite 8 + React 19 + TypeScript (SPA) |
| Routing | None (view state in `App.tsx`) |
| Database | None (`localStorage` only) |
| Auth | None |
| API / Backend | None |
| Calendar | None (static weekly ideas list) |
| Assets / Telegram | None |
| AI | Template caption generator only (`src/lib/generator.ts`) |
| UI | Persian RTL, light premium minimal (not dark SaaS yet) |
| Deploy shape | Static SPA + PWA (`manifest` + `sw.js`) |

---

## A. Current Architecture

```
postyar (SPA)
├── index.html + PWA (manifest, sw.js)
├── src/App.tsx          # single-page shell + view switching
├── src/components/      # Hero, Generator, Result, Pages, Ideas, History
├── src/lib/generator.ts # offline caption/hashtag/reel template engine
├── src/lib/storage.ts   # localStorage persistence
└── src/types.ts         # InstagramPage, GenerateInput, GeneratedContent
```

- **State:** React `useState` in `App.tsx` (no Redux/Zustand/React Query).
- **Persistence:** `localStorage` keys `postyar_pages`, `postyar_history`, `postyar_active_page`.
- **No** server, DB, auth, routes, asset pipeline, or Telegram integration.

## B. Existing Features (keep / reuse)

1. **Studio generator** — hook, caption, hashtags, CTA, visual idea, reel script, carousel outline.
2. **Instagram pages** — name, niche, audience, brand voice.
3. **Weekly ideas** — static 7-day prompts → open in Studio.
4. **History** — last 40 generations, copy/reuse.
5. **RTL Persian UI + PWA** — brand, motion, copy UX.
6. **Format vocabulary** — feed/reel/story/carousel (maps to Content Types later).

## C. Required Changes (high level)

Must **add** (do not rewrite Studio first):

| Layer | Add |
|-------|-----|
| Backend | Node API (Hono recommended) for Telegram webhook, assets, content CRUD |
| Database | SQLite (local) → Turso/libSQL or Neon (free prod) via Drizzle |
| Auth | Workspace-scoped sessions (email magic link or password) |
| Frontend router | React Router — Dashboard, Calendar, Content, Ideas, Assets, Telegram, … |
| Domain models | Workspace, Project, Campaign, Content, Asset, Tag, Membership |
| StorageProvider | Interface + `TelegramStorageProvider` |
| Telegram | Webhook, status, limited sync, download proxy |
| UI shell | App sidebar nav; keep Studio as `/studio` module |

Evolve existing:

- `InstagramPage` → Workspace channel/brand profile (Instagram-first).
- `GeneratedContent` / Ideas → `Content` + `Idea` with status workflow.
- `weeklyIdeas` → seed Ideas / calendar suggestions.
- Keep generator as **AI-ready assistant module** (not core CMS).

## D. Database Plan (proposed)

```
Workspace 1──* Membership *──1 User
Workspace 1──* Project 1──* Campaign 1──* Content
Workspace 1──* Asset
Content *──* Asset (ContentAsset)
Content/Asset *──* Tag (join tables)
Asset 1──0..1 TelegramSource (file_unique_id UNIQUE)
Content 1──* ContentStatusHistory
```

Core fields align with product spec (platforms[], type, status, publishAt, caption, hashtags, assignee, notes, AI metadata JSON).

## E. Telegram Architecture

```
Private Channel → Bot → POST /api/telegram/webhook
  → validate secret + allowlisted chat_id
  → extract file metadata
  → upsert by telegram_file_unique_id (idempotent)
  → Asset + TelegramSource
Web App → GET /api/assets/:id/download → StorageProvider.download() → stream
```

`StorageProvider`: `getMetadata`, `download`, `getPreview`, `delete`  
Impl v1: `TelegramStorageProvider` (Bot API; Local Bot API later).

**Honest limits:** Bot API ~20MB download; no reliable full historical channel crawl via Bot API alone; sync = missed webhooks / recent updates, not “export entire channel”. Larger files → Local Bot API Server (usually needs VPS).

## F. Free-Tier Feasibility

| Free / OK | Needs care / paid later |
|-----------|-------------------------|
| Vite frontend, Telegram storage of blobs, SQLite/Turso/Neon free DB, Cloudflare/Render/Fly free web | Public HTTPS for webhooks; Local Bot API / files >20MB (VPS); heavy bandwidth egress |

## G. Implementation Plan (phased)

0. Docs + domain types (no UX break)  
1. Backend + DB + Auth skeleton  
2. Content CRUD + status workflow + Calendar views  
3. Ideas/Projects/Campaigns  
4. Telegram webhook + Assets browser + attach + download  
5. Dashboard + search + polish + tests + docs  

Preserve `/studio` throughout.
