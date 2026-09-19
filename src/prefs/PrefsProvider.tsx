import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en, fa, type Dict, type Lang } from '../i18n/strings'

export type Theme = 'light' | 'dark'

const LANG_KEY = 'postyar_lang'
const THEME_KEY = 'postyar_theme'

function readLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'fa'
  } catch {
    return 'fa'
  }
}

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function lookup(dict: Dict, key: string): string {
  const parts = key.split('.')
  let cur: unknown = dict
  for (const part of parts) {
    if (!cur || typeof cur !== 'object') return key
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string' ? cur : key
}

type Prefs = {
  lang: Lang
  theme: Theme
  setLang: (lang: Lang) => void
  setTheme: (theme: Theme) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  n: (value: number, digits?: number) => string
  d: (iso?: string) => string
  weekday: (key: string) => string
}

const PrefsContext = createContext<Prefs | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (typeof window === 'undefined' ? 'fa' : readLang()))
  const [theme, setThemeState] = useState<Theme>(() => (typeof window === 'undefined' ? 'light' : readTheme()))

  useEffect(() => {
    const html = document.documentElement
    html.lang = lang
    html.dir = lang === 'fa' ? 'rtl' : 'ltr'
    html.dataset.theme = theme
    document.title = lang === 'fa' ? fa.docTitle : en.docTitle
    const themeColor = theme === 'dark' ? '#10161b' : '#0f2f2c'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
    try {
      localStorage.setItem(LANG_KEY, lang)
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [lang, theme])

  const dict = lang === 'en' ? en : fa

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const raw = lookup(dict, key)
      if (!vars) return raw
      return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''))
    },
    [dict],
  )

  const n = useCallback(
    (value: number, digits = 0) =>
      new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(value),
    [lang],
  )

  const d = useCallback(
    (iso?: string) => {
      if (!iso) return ''
      const date = new Date(iso)
      if (!Number.isFinite(date.getTime())) return ''
      return date.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US')
    },
    [lang],
  )

  const weekday = useCallback((key: string) => lookup(dict, `days.${key}`) || key, [dict])

  const value = useMemo(
    () => ({
      lang,
      theme,
      setLang: setLangState,
      setTheme: setThemeState,
      t,
      n,
      d,
      weekday,
    }),
    [lang, theme, t, n, d, weekday],
  )

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function useI18n() {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('PrefsProvider is required')
  return ctx
}
