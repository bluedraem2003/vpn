import { useEffect, useState } from 'react'
import type { AssetDto } from '../api/client'
import { api } from '../api/client'

function resolveMime(asset: AssetDto, headerType: string | null) {
  if (headerType && !headerType.includes('octet-stream') && !headerType.includes('application/json')) {
    return headerType.split(';')[0]!.trim()
  }
  if (asset.mimeType && !asset.mimeType.includes('octet-stream')) return asset.mimeType
  if (asset.type === 'image') return 'image/jpeg'
  if (asset.type === 'video') return 'image/jpeg'
  return 'image/jpeg'
}

/** Lightweight thumb for asset cards — retypes Telegram octet-stream for Safari. */
export function AssetThumb({ asset }: { asset: AssetDto }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (asset.type !== 'image' && asset.type !== 'video') return
    let revoked: string | null = null
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/assets/${asset.id}/preview`, {
          headers: api.authHeaders(),
        })
        if (!res.ok) return
        const headerType = res.headers.get('content-type') || ''
        if (headerType.includes('application/json')) return
        const raw = await res.arrayBuffer()
        const blob = new Blob([raw], { type: resolveMime(asset, headerType) })
        const objectUrl = URL.createObjectURL(blob)
        revoked = objectUrl
        if (!cancelled) setUrl(objectUrl)
      } catch {
        /* keep text fallback */
      }
    })()
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [asset.id, asset.type, asset.mimeType])

  if (url) {
    return <img className="asset-thumb-img" src={url} alt="" loading="lazy" decoding="async" />
  }
  return <span className="asset-thumb-label">{asset.type}</span>
}
