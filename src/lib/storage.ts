import type { GeneratedContent } from '../types'

const HISTORY_KEY = 'postyar_history'
const ACTIVE_PAGE_KEY = 'postyar_active_page'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadActivePageId(): string | null {
  return localStorage.getItem(ACTIVE_PAGE_KEY)
}

export function saveActivePageId(id: string | null) {
  if (!id) localStorage.removeItem(ACTIVE_PAGE_KEY)
  else localStorage.setItem(ACTIVE_PAGE_KEY, id)
}

export function loadHistory(): GeneratedContent[] {
  return read<GeneratedContent[]>(HISTORY_KEY, [])
}

export function saveHistory(items: GeneratedContent[]) {
  write(HISTORY_KEY, items.slice(0, 40))
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
