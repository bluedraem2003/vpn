import { useEffect, useState } from 'react'
import type { AssetDto } from '../api/client'
import { api } from '../api/client'

function resolveMime(asset: AssetDto, headerType: string | null) {
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

export function AssetPreviewModal({
  asset,
  authToken,
  onClose,
}: {
  asset: AssetDto
  authToken?: string
  onClose: () => void
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ message?: string; previewable?: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tagInput, setTagInput] = useState((asset.tags || []).join(', '))

  useEffect(() => {
    let revoked: string | null = null
    let cancelled = false
    setLoading(true)
    setError(null)
    setMeta(null)
    setBlobUrl(null)

    ;(async () => {
      try {
        const token = authToken || api.getToken()
        const res = await fetch(`/api/assets/${asset.id}/preview`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const headerType = res.headers.get('content-type') || ''
        if (headerType.includes('application/json')) {
          const data = await res.json()
          if (!cancelled) {
            if (!res.ok) setError(data.error || 'پیش‌نمایش ناموفق')
            else setMeta(data)
          }
          return
        }
        if (!res.ok) {
          if (!cancelled) setError('پیش‌نمایش ناموفق')
          return
        }
        const raw = await res.arrayBuffer()
        const mime = resolveMime(asset, headerType)
        const blob = new Blob([raw], { type: mime })
        const url = URL.createObjectURL(blob)
        revoked = url
        if (!cancelled) setBlobUrl(url)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [asset.id, asset.type, asset.mimeType, asset.filename, authToken])

  async function saveTags() {
    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    await api.updateAsset(asset.id, { tags })
  }

  async function download() {
    const token = authToken || api.getToken()
    const res = await fetch(`/api/assets/${asset.id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      setError('دانلود ناموفق بود')
      return
    }
    const raw = await res.arrayBuffer()
    const mime = resolveMime(asset, res.headers.get('content-type'))
    const blob = new Blob([raw], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = asset.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="panel panel-pad modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="result-head">
          <div>
            <h2 className="section-title" style={{ marginBottom: 4 }}>
              {asset.filename}
            </h2>
            <p className="section-sub" style={{ marginBottom: 0 }}>
              {asset.type}
              {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
            </p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            بستن
          </button>
        </div>

        <div className="preview-stage">
          {loading && <p className="section-sub">در حال بارگذاری پیش‌نمایش...</p>}
          {error && <p className="section-sub">{error}</p>}
          {meta && <p className="section-sub">{meta.message || 'پیش‌نمایش فایل در دسترس نیست'}</p>}
          {blobUrl && asset.type === 'image' && (
            <img src={blobUrl} alt={asset.filename} decoding="async" />
          )}
          {blobUrl && asset.type === 'video' && <video src={blobUrl} controls playsInline />}
          {blobUrl && asset.type === 'audio' && <audio src={blobUrl} controls />}
          {blobUrl && (asset.type === 'pdf' || asset.type === 'document') && (
            <iframe title={asset.filename} src={blobUrl} />
          )}
          {blobUrl && !['image', 'video', 'audio', 'pdf', 'document'].includes(asset.type) && (
            <p className="section-sub">فایل آماده دانلود است.</p>
          )}
        </div>

        <div className="field" style={{ marginTop: '0.85rem' }}>
          <label>تگ‌ها (با ویرگول)</label>
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Reel, Final, Cover" />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-solid btn-sm" onClick={() => void saveTags()}>
            ذخیره تگ
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void download()}>
            دانلود
          </button>
        </div>
      </div>
    </div>
  )
}
