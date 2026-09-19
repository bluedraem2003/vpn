import { createHmac, timingSafeEqual } from 'node:crypto'

function secret() {
  return process.env.MEDIA_PROXY_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || 'postyar-local-media'
}

export function isAllowedIgMediaHost(hostname: string) {
  const h = hostname.toLowerCase()
  return (
    h === 'cdninstagram.com' ||
    h.endsWith('.cdninstagram.com') ||
    h === 'fbcdn.net' ||
    h.endsWith('.fbcdn.net')
  )
}

export function signInstagramMediaUrl(raw: string) {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return undefined
  }
  if (parsed.protocol !== 'https:' || !isAllowedIgMediaHost(parsed.hostname)) return undefined
  const url = parsed.toString()
  const exp = Math.floor(Date.now() / 1000) + 6 * 3600
  const sig = createHmac('sha256', secret()).update(`${exp}\n${url}`).digest('hex').slice(0, 32)
  return `/api/instagram/media?${new URLSearchParams({ url, exp: String(exp), sig })}`
}

export function verifyInstagramMediaSig(url: string, exp: string, sig: string) {
  if (!url || !exp || !sig || !/^\d+$/.test(exp) || !/^[a-f0-9]{32}$/.test(sig)) return false
  if (Number(exp) < Math.floor(Date.now() / 1000) - 30) return false
  const expected = createHmac('sha256', secret()).update(`${exp}\n${url}`).digest('hex').slice(0, 32)
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  } catch {
    return false
  }
}
