import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { LoaderCircle, Search } from 'lucide-react'
import { api, type IgPageHit } from '../api/client'
import { isLikelyIgHandle, normalizeHandle } from '../lib/handle'

type Props = {
  id?: string
  value: string
  disabled?: boolean
  onChange: (handle: string) => void
  onPick?: (hit: IgPageHit) => void
}

function typedHit(query: string): IgPageHit | null {
  const handle = isLikelyIgHandle(query) ? normalizeHandle(query) : ''
  if (!handle) return null
  return { username: handle, name: handle, source: 'typed' }
}

export function InstagramPageSearch({ id, value, disabled, onChange, onPick }: Props) {
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
    if (!open || query.length < 1) {
      setItems([])
      setBusy(false)
      return
    }
    let cancelled = false
    setBusy(true)
    setErr(null)
    const t = window.setTimeout(() => {
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
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [q, open])

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
    instagram: 'اینستاگرام',
    workspace: 'پیج ذخیره‌شده',
    typed: 'آیدی واردشده',
    wikidata: 'کاتالوگ عمومی',
  }

  function followersLabel(n?: number) {
    if (!n) return ''
    return ` · ${new Intl.NumberFormat('fa-IR').format(n)} دنبال‌کننده`
  }

  return (
    <div className="field" ref={wrapRef}>
      <label htmlFor={id}>جستجو و انتخاب پیج اینستاگرام</label>
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
            placeholder="نام یا آیدی را بنویس، مثلاً karaland"
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
            {busy && shown.length === 0 && <p className="ig-search-empty">در حال جستجوی پیج‌ها...</p>}
            {!busy && shown.length === 0 && (
              <p className="ig-search-empty">
                {q.trim()
                ? 'پیجی در اینستاگرام پیدا نشد — آیدی را دقیق‌تر بنویس'
                : 'نام یا آیدی پیج اینستاگرام را بنویس تا لیست بیاید'}
              </p>
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
                <span className="ig-search-pick">انتخاب</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <span className="field-hint">
        پیج‌هایی که داخل اینستاگرام هستند را همین‌جا جستجو کن و از لیست انتخاب کن
      </span>
      {err && !shown.length && <span className="field-hint warn">{err}</span>}
    </div>
  )
}
