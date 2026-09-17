import { useEffect, useState } from 'react'
import { api, type AssetDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { AssetPreviewModal } from '../components/AssetPreviewModal'
import { AssetThumb } from '../components/AssetThumb'

function resolveDownloadMime(asset: AssetDto, headerType: string | null) {
  if (headerType && !headerType.includes('octet-stream') && !headerType.includes('application/json')) {
    return headerType.split(';')[0]!.trim()
  }
  if (asset.mimeType && !asset.mimeType.includes('octet-stream')) return asset.mimeType
  if (asset.type === 'image') return 'image/jpeg'
  if (asset.type === 'video') return 'video/mp4'
  if (asset.type === 'audio') return 'audio/mpeg'
  if (asset.type === 'pdf') return 'application/pdf'
  return headerType || 'application/octet-stream'
}

export function AssetsPage() {
  const { workspaceId, session } = useAuth()
  const [items, setItems] = useState<AssetDto[]>([])
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [sort, setSort] = useState('newest')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<AssetDto | null>(null)

  async function reload() {
    if (!workspaceId) return
    const res = await api.listAssets(workspaceId, { type, q, sort })
    setItems(res.items)
  }

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.listAssets(workspaceId, { type, q, sort })
        if (!cancelled) setItems(res.items)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [workspaceId, type, q, sort])

  async function downloadAsset(asset: AssetDto) {
    const res = await fetch(`/api/assets/${asset.id}/download`, {
      headers: api.authHeaders(),
    })
    if (!res.ok) {
      setError('دانلود ناموفق بود')
      return
    }
    const raw = await res.arrayBuffer()
    const mime = resolveDownloadMime(asset, res.headers.get('content-type'))
    const blob = new Blob([raw], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = asset.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>دارایی‌ها</h1>
          <p>مرور فایل‌های ایندکس‌شده از تلگرام و اتصال به محتوا</p>
        </div>
      </header>

      <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <div className="ops-filters">
          <input
            placeholder="جستجو نام فایل / کپشن..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">همه</option>
            <option value="image">تصویر</option>
            <option value="video">ویدیو</option>
            <option value="audio">صوت</option>
            <option value="document">سند</option>
            <option value="pdf">PDF</option>
            <option value="archive">آرشیو</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">جدیدترین</option>
            <option value="oldest">قدیمی‌ترین</option>
            <option value="largest">بزرگ‌ترین</option>
            <option value="smallest">کوچک‌ترین</option>
            <option value="name">نام</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="panel panel-pad">
          <p className="section-sub">{error}</p>
        </div>
      )}

      <div className="asset-grid">
        {items.length === 0 && !error && (
          <div className="panel panel-pad empty">
            <strong>فایلی نیست</strong>
            از صفحه تلگرام Webhook را وصل کنید یا فایلی به کانال بفرستید.
          </div>
        )}
        {items.map((asset) => (
          <article
            key={asset.id}
            className="panel asset-card asset-card-openable"
            role="button"
            tabIndex={0}
            onClick={() => setPreview(asset)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setPreview(asset)
              }
            }}
          >
            <div className="asset-thumb">
              <AssetThumb asset={asset} />
            </div>
            <div className="asset-body">
              <h3>{asset.filename}</h3>
              <p>
                {asset.type}
                {asset.fileSize ? ` · ${(asset.fileSize / (1024 * 1024)).toFixed(1)} MB` : ''}
                {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
              </p>
              <div className="chip-row">
                {asset.tags.map((t) => (
                  <span className="tag" key={t}>
                    #{t}
                  </span>
                ))}
              </div>
              <div className="form-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="btn btn-solid btn-sm" onClick={() => setPreview(asset)}>
                  باز کردن
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void downloadAsset(asset)}>
                  دانلود
                </button>
                <span className="meta-badge">{asset.status}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {preview && (
        <AssetPreviewModal
          asset={preview}
          authToken={session?.token || api.getToken() || undefined}
          onClose={() => {
            setPreview(null)
            void reload().catch(() => null)
          }}
        />
      )}
    </div>
  )
}
