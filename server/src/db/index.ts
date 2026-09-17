import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = join(__dirname, '../../data')
export const DB_PATH = process.env.DATABASE_PATH || join(DATA_DIR, 'postyar.sqlite')

mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      UNIQUE(workspace_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      client_name TEXT,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      goal TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      platforms TEXT NOT NULL DEFAULT '[]',
      start_date TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      UNIQUE(workspace_id, name)
    );

    CREATE TABLE IF NOT EXISTS contents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
      assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      platforms TEXT NOT NULL DEFAULT '[]',
      content_type TEXT NOT NULL,
      status TEXT NOT NULL,
      publish_date TEXT,
      publish_time TEXT,
      caption TEXT,
      hashtags TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      ai_meta TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_status_history (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      virtual_folder TEXT NOT NULL DEFAULT 'raw',
      filename TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      width INTEGER,
      height INTEGER,
      duration REAL,
      storage_provider TEXT NOT NULL DEFAULT 'telegram',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS telegram_sources (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
      telegram_file_id TEXT NOT NULL,
      telegram_file_unique_id TEXT NOT NULL UNIQUE,
      telegram_message_id INTEGER NOT NULL,
      telegram_chat_id TEXT NOT NULL,
      filename TEXT,
      mime_type TEXT,
      file_size INTEGER,
      width INTEGER,
      height INTEGER,
      duration REAL,
      caption TEXT,
      thumbnail_file_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_assets (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'other',
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(content_id, asset_id)
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      reference TEXT,
      platforms TEXT NOT NULL DEFAULT '[]',
      content_type TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      tags TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      converted_content_id TEXT REFERENCES contents(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_contents_workspace_status ON contents(workspace_id, status);
    CREATE INDEX IF NOT EXISTS idx_contents_publish ON contents(publish_date, publish_time);
    CREATE INDEX IF NOT EXISTS idx_assets_workspace_type ON assets(workspace_id, type);
    CREATE INDEX IF NOT EXISTS idx_telegram_chat ON telegram_sources(telegram_chat_id);
  `)
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM workspaces').get() as { c: number }
  if (row.c > 0) return

  const now = new Date().toISOString()
  const userId = uid('user')
  const workspaceId = uid('ws')
  const membershipId = uid('mem')

  db.prepare(
    `INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)`,
  ).run(userId, 'owner@postyar.local', 'مدیر محتوا', now)

  db.prepare(
    `INSERT INTO workspaces (id, name, slug, created_at) VALUES (?, ?, ?, ?)`,
  ).run(workspaceId, 'ورک‌اسپیس اصلی', 'main', now)

  db.prepare(
    `INSERT INTO memberships (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)`,
  ).run(membershipId, workspaceId, userId, 'admin')
}
