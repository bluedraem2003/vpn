import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { LoaderCircle, Search } from 'lucide-react'
import { api, type IgPageHit } from '../api/client'
import { isLikelyIgHandle, normalizeHandle } from '../lib/handle'
import { useI18n } from '../prefs/PrefsProvider'

type Props = {
  id?: string
  value: string
  disabled?: boolean
  label?: string
  hint?: string
  placeholder?: string
  allowRemoteSearch?: boolean
  onChange: (handle: string) => void
  onPick?: (hit: IgPageHit) => void
}

function typedHit(query: string): IgPageHit | null {
  const handle = isLikelyIgHandle(query) ? normalizeHandle(query) : ''
  if (!handle) return null
  return { username: handle, name: handle, source: 'typed' }
}

export function InstagramPageSearch({
  id,
  value,
  disabled,
  label,
  hint,
  placeholder,
  allowRemoteSearch = true,
  onChange,
  onPick,
}: Props) {
  const { t, n } = useI18n()
  const resolvedLabel = label || t('search.label')
  const resolvedHint = hint || t('search.hint')
  const resolvedPlaceholder = placeholder || t('search.placeholder')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState(value)
  const [items, setItems] = useState<IgPageHit[]>([])
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setQ(value)
  }, [value])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    const query = q.trim()
    const skipRemote = !allowRemoteSearch
    if (!open || query.length < 1 || skipRemote) {
      setItems([])
      setBusy(false)
      return
    }
    let cancelled = false
    setBusy(true)
    setErr(null)
    const timer = window.setTimeout(() => {
      void api
        .searchInstagramPages(query)
        .then((res) => {
          if (cancelled) return
          setItems(res.items || [])
          setActive(0)
        })
        .catch((e) => {
          if (cancelled) return
          const fallback = typedHit(query)
          setItems(fallback ? [fallback] : [])
          setErr((e as Error).message)
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 450)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [q, open, allowRemoteSearch])

  const shown = useMemo(() => {
    const local = typedHit(q)
    if (!local) return items
    if (items.some((item) => item.username.toLowerCase() === local.username.toLowerCase())) return items
    return [local, ...items]
  }, [items, q])

  function pick(hit: IgPageHit) {
    onChange(hit.username)
    onPick?.(hit)
    setQ(hit.username)
    setOpen(false)
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!shown.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % shown.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + shown.length) % shown.length)
    } else if (e.key === 'Enter' && shown[active]) {
      e.preventDefault()
      pick(shown[active]!)
    }
  }

  const sourceLabel: Record<string, string> = {
    instagram: t('search.instagram'),
    workspace: t('search.workspace'),
    typed: t('search.typed'),
    wikidata: t('search.wikidata'),
  }

  function followersLabel(count?: number) {
    if (!count) return ''
    return t('search.followers', { n: n(count) })
  }

  return (
    <div className="field" ref={wrapRef}>
      <label htmlFor={id}>{resolvedLabel}</label>
      <div className="ig-search-wrap">
        <div className={`ig-search ${open ? 'open' : ''}`}>
          {busy ? (
            <LoaderCircle size={16} className="ig-search-icon spin" aria-hidden />
          ) : (
            <Search size={16} className="ig-search-icon" aria-hidden />
          )}
          <span className="ig-at">@</span>
          <input
            id={id}
            value={q}
            disabled={disabled}
            dir="ltr"
            autoComplete="off"
            placeholder={resolvedPlaceholder}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              const next = e.target.value
              setQ(next)
              onChange(normalizeHandle(next) || next.replace(/^@/, ''))
              setOpen(true)
            }}
            onKeyDown={onKey}
            aria-autocomplete="list"
            aria-expanded={open}
            role="combobox"
          />
        </div>
        {open && (
          <div className="ig-search-list" role="listbox">
            {busy && shown.length === 0 && <p className="ig-search-empty">{t('search.searching')}</p>}
            {!busy && shown.length === 0 && (
              <p className="ig-search-empty">{q.trim() ? t('search.none') : t('search.typeHint')}</p>
            )}
            {shown.map((item, idx) => (
              <button
                key={`${item.source}-${item.username}`}
                type="button"
                role="option"
                aria-selected={idx === active}
                className={`ig-search-item ${idx === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(idx)}
                onClick={() => pick(item)}
              >
                {item.avatarUrl ? (
                  <img className="ig-search-avatar" src={item.avatarUrl} alt="" />
                ) : (
                  <span className="ig-search-avatar letter" aria-hidden>
                    {(item.name || item.username).slice(0, 1)}
                  </span>
                )}
                <span className="ig-search-meta">
                  <strong>
                    {item.name || item.username}
                    {item.verified ? ' ✓' : ''}
                  </strong>
                  <span>
                    <bdi>@{item.username}</bdi>
                    {item.source ? ` · ${sourceLabel[item.source] || ''}` : ''}
                    {followersLabel(item.followers)}
                  </span>
                </span>
                <span className="ig-search-pick">{t('search.pick')}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {resolvedHint ? <span className="field-hint">{resolvedHint}</span> : null}
      {err && !shown.length && <span className="field-hint warn">{err}</span>}
    </div>
  )
}
