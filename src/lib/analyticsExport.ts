import type { PageAnalyticsResponse, PageInsights } from '../api/client'
import { exportPayload } from './collabSnapshot'

type Translate = (key: string, vars?: Record<string, string | number>) => string
type NumFmt = (value: number, digits?: number) => string
type DateFmt = (iso?: string) => string
type Weekday = (key: string) => string

export type ExportTheme = {
  t: Translate
  n: NumFmt
  d: DateFmt
  weekday: Weekday
  lang: 'fa' | 'en'
  brand: string
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function downloadPageReportJson(report: PageAnalyticsResponse) {
  const payload = exportPayload(report)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  downloadBlob(`postyar-${report.page.handle}-analytics.json`, blob)
}

function fillUi(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  rtl: boolean,
) {
  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textAlign = rtl ? 'right' : 'left'
  ctx.fillText(text, x, y)
}

function fillHandle(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  rtl: boolean,
) {
  ctx.save()
  ctx.direction = 'ltr'
  ctx.textAlign = 'left'
  const width = ctx.measureText(text).width
  ctx.fillText(text, rtl ? x - width : x, y)
  ctx.restore()
}

function drawListBox(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number
    y: number
    w: number
    h: number
    title: string
    empty: string
    rows: Array<{ label: string; meta: string; ltr?: boolean }>
    rtl: boolean
    panel: string
    line: string
    ink: string
    muted: string
  },
) {
  const { x, y, w, h, rtl } = opts
  roundRect(ctx, x, y, w, h, 22)
  ctx.fillStyle = opts.panel
  ctx.fill()
  ctx.strokeStyle = opts.line
  ctx.lineWidth = 1.5
  ctx.stroke()
  const start = rtl ? x + w - 22 : x + 22
  const end = rtl ? x + 22 : x + w - 22
  ctx.fillStyle = opts.ink
  ctx.font = '700 18px Vazirmatn, sans-serif'
  fillUi(ctx, opts.title, start, y + 36, rtl)
  ctx.font = '400 16px Vazirmatn, sans-serif'
  if (!opts.rows.length) {
    ctx.fillStyle = opts.muted
    fillUi(ctx, opts.empty, start, y + 70, rtl)
    return
  }
  opts.rows.forEach((row, i) => {
    const yy = y + 70 + i * 32
    ctx.fillStyle = opts.ink
    if (row.ltr) fillHandle(ctx, row.label, start, yy, rtl)
    else fillUi(ctx, row.label, start, yy, rtl)
    ctx.fillStyle = opts.muted
    ctx.direction = rtl ? 'rtl' : 'ltr'
    ctx.textAlign = rtl ? 'left' : 'right'
    ctx.fillText(row.meta, end, yy)
  })
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const words = clean.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) {
      cur = next
      continue
    }
    if (cur) lines.push(cur)
    if (ctx.measureText(word).width <= maxWidth) {
      cur = word
      continue
    }
    let chunk = ''
    for (const ch of word) {
      if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
        lines.push(chunk)
        chunk = ch
      } else {
        chunk += ch
      }
    }
    cur = chunk
  }
  if (cur) lines.push(cur)
  return lines
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function loadImage(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src.startsWith('http') || src.startsWith('data:') ? src : src
  })
}

async function waitForFonts() {
  try {
    await Promise.all([
      document.fonts.load('700 42px Vazirmatn'),
      document.fonts.load('600 28px Vazirmatn'),
      document.fonts.load('500 22px Vazirmatn'),
      document.fonts.load('400 18px Vazirmatn'),
    ])
    await document.fonts.ready
  } catch {
    /* canvas will fall back to sans-serif */
  }
}

function pct(n: NumFmt, value: number, digits = 2) {
  return `${n(value, digits)}٪`
}

export async function downloadPageReportPng(page: PageInsights, theme: ExportTheme) {
  await waitForFonts()
  const avatar = await loadImage(page.avatarUrl)
  const rtl = theme.lang !== 'en'
  const W = 1600
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = 2400 * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.scale(scale, scale)
  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textAlign = rtl ? 'right' : 'left'
  ctx.textBaseline = 'alphabetic'

  const bg = '#f4efe8'
  const ink = '#14181c'
  const muted = '#5b6570'
  const accent = '#1b6b63'
  const panel = '#fffcf8'
  const line = 'rgba(20, 24, 28, 0.1)'
  const pad = 56
  const startX = rtl ? W - pad : pad

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, 2400)

  ctx.fillStyle = accent
  ctx.fillRect(0, 0, W, 8)

  ctx.font = '700 18px Vazirmatn, sans-serif'
  ctx.fillStyle = accent
  ctx.fillText(theme.brand, startX, 48)
  ctx.font = '500 16px Vazirmatn, sans-serif'
  ctx.fillStyle = muted
  ctx.fillText(theme.t('analytics.posterKicker'), startX, 74)

  roundRect(ctx, pad, 100, W - pad * 2, 220, 28)
  ctx.fillStyle = panel
  ctx.fill()
  ctx.strokeStyle = line
  ctx.lineWidth = 1.5
  ctx.stroke()

  const avX = rtl ? W - pad - 28 - 112 : pad + 28
  const avY = 124
  ctx.save()
  ctx.beginPath()
  ctx.arc(avX + 56, avY + 56, 56, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  if (avatar) {
    ctx.drawImage(avatar, avX, avY, 112, 112)
  } else {
    const g = ctx.createLinearGradient(avX, avY, avX + 112, avY + 112)
    g.addColorStop(0, '#f58529')
    g.addColorStop(1, '#8134af')
    ctx.fillStyle = g
    ctx.fillRect(avX, avY, 112, 112)
    ctx.fillStyle = '#fff'
    ctx.font = '700 44px Vazirmatn, sans-serif'
    ctx.textAlign = 'center'
    ctx.direction = 'ltr'
    ctx.fillText((page.name || page.handle).slice(0, 1).toUpperCase(), avX + 56, avY + 70)
  }
  ctx.restore()

  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textAlign = rtl ? 'right' : 'left'
  const textX = rtl ? W - pad - 28 - 112 - 24 : pad + 28 + 112 + 24
  ctx.fillStyle = ink
  ctx.font = '700 36px Vazirmatn, sans-serif'
  const nameLines = wrapLines(ctx, page.name || page.handle, 860).slice(0, 2)
  nameLines.forEach((line, i) => ctx.fillText(line, textX, 168 + i * 40))
  ctx.font = '600 20px Vazirmatn, sans-serif'
  ctx.fillStyle = muted
  ctx.direction = 'ltr'
  ctx.textAlign = rtl ? 'right' : 'left'
  ctx.fillText(`@${page.handle}${page.category ? ` · ${page.category}` : ''}`, textX, 168 + nameLines.length * 40 + 8)
  ctx.direction = rtl ? 'rtl' : 'ltr'
  if (page.biography) {
    ctx.font = '400 16px Vazirmatn, sans-serif'
    ctx.fillStyle = ink
    wrapLines(ctx, page.biography, 860)
      .slice(0, 2)
      .forEach((line, i) => ctx.fillText(line, textX, 168 + nameLines.length * 40 + 36 + i * 22))
  }

  const healthX = rtl ? pad + 28 : W - pad - 28 - 110
  roundRect(ctx, healthX, 132, 110, 110, 22)
  ctx.fillStyle = 'rgba(27, 107, 99, 0.12)'
  ctx.fill()
  ctx.fillStyle = accent
  ctx.textAlign = 'center'
  ctx.direction = 'ltr'
  ctx.font = '700 40px Vazirmatn, sans-serif'
  ctx.fillText(theme.n(page.health.score), healthX + 55, 188)
  ctx.font = '500 13px Vazirmatn, sans-serif'
  ctx.fillStyle = muted
  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.fillText(theme.t('analytics.health'), healthX + 55, 214)

  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textAlign = rtl ? 'right' : 'left'

  const stats: Array<[string, string]> = [
    [theme.t('analytics.followers'), theme.n(page.followers)],
    [theme.t('analytics.following'), theme.n(page.following)],
    [theme.t('analytics.posts'), theme.n(page.posts)],
    [theme.t('analytics.engagement'), pct(theme.n, page.engagementRate)],
    [theme.t('analytics.avgLikes'), theme.n(page.avgLikes)],
    [theme.t('analytics.avgComments'), theme.n(page.avgComments)],
    [theme.t('analytics.avgViews'), page.avgViews ? theme.n(page.avgViews) : '—'],
    [theme.t('analytics.ratio'), theme.n(page.followerFollowingRatio, 1)],
    [
      theme.t('analytics.cadence'),
      page.postCadenceDays != null ? theme.t('analytics.daysUnit', { n: theme.n(page.postCadenceDays, 1) }) : '—',
    ],
    [
      theme.t('analytics.window'),
      page.bestDay && page.bestHour
        ? theme.t('analytics.suggested', { day: theme.weekday(page.bestDay), hour: page.bestHour })
        : '—',
    ],
    [theme.t('analytics.lastPost'), page.lastPostedAt ? theme.d(page.lastPostedAt) : '—'],
    [
      theme.t('analytics.playRate'),
      page.reelPlayRate != null ? pct(theme.n, page.reelPlayRate, 1) : '—',
    ],
  ]

  const cols = 4
  const gap = 14
  const cardW = (W - pad * 2 - gap * (cols - 1)) / cols
  const cardH = 92
  const statsTop = 348
  stats.forEach((stat, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = rtl ? W - pad - (col + 1) * cardW - col * gap : pad + col * (cardW + gap)
    const y = statsTop + row * (cardH + gap)
    roundRect(ctx, x, y, cardW, cardH, 18)
    ctx.fillStyle = panel
    ctx.fill()
    ctx.strokeStyle = line
    ctx.stroke()
    ctx.fillStyle = muted
    ctx.font = '500 14px Vazirmatn, sans-serif'
    fillUi(ctx, stat[0], rtl ? x + cardW - 16 : x + 16, y + 32, rtl)
    ctx.fillStyle = ink
    ctx.font = '700 22px Vazirmatn, sans-serif'
    wrapLines(ctx, stat[1], cardW - 28)
      .slice(0, 2)
      .forEach((line, li) => fillUi(ctx, line, rtl ? x + cardW - 16 : x + 16, y + 62 + li * 20, rtl))
  })

  const mixTop = statsTop + 3 * (cardH + gap) + 8
  roundRect(ctx, pad, mixTop, W - pad * 2, 118, 22)
  ctx.fillStyle = panel
  ctx.fill()
  ctx.strokeStyle = line
  ctx.stroke()
  ctx.fillStyle = ink
  ctx.font = '700 18px Vazirmatn, sans-serif'
  fillUi(ctx, theme.t('analytics.typePerf'), startX, mixTop + 34, rtl)
  const mixTotal = Math.max(1, page.mix.reel + page.mix.carousel + page.mix.post)
  const mixLine = theme.t('analytics.mixLine', {
    n: theme.n(mixTotal),
    reel: theme.n(page.mix.reel),
    carousel: theme.n(page.mix.carousel),
    post: theme.n(page.mix.post),
  })
  ctx.font = '400 16px Vazirmatn, sans-serif'
  ctx.fillStyle = muted
  fillUi(ctx, mixLine, startX, mixTop + 62, rtl)

  const barY = mixTop + 80
  const barW = W - pad * 2 - 40
  const barX = pad + 20
  const colors = ['#1b6b63', '#e07a5f', '#5b6570']
  const parts = [page.mix.reel, page.mix.carousel, page.mix.post]
  let bx = barX
  parts.forEach((count, i) => {
    const w = (count / mixTotal) * barW
    ctx.fillStyle = colors[i]!
    ctx.fillRect(bx, barY, Math.max(count ? 6 : 0, w), 14)
    bx += w
  })

  const tagsTop = mixTop + 140
  const boxW = (W - pad * 2 - 16) / 2
  const hashX = rtl ? pad + boxW + 16 : pad
  const collabX = rtl ? pad : pad + boxW + 16
  drawListBox(ctx, {
    x: hashX,
    y: tagsTop,
    w: boxW,
    h: 280,
    title: theme.t('analytics.hashtags'),
    empty: theme.t('analytics.emptyTags'),
    rows: (page.topHashtags || []).slice(0, 6).map((tag) => ({
      label: tag.key.startsWith('#') ? tag.key : `#${tag.key}`,
      meta: theme.t('analytics.times', { n: theme.n(tag.count), er: theme.n(tag.avgEngagement, 1) }),
      ltr: true,
    })),
    rtl,
    panel,
    line,
    ink,
    muted,
  })
  drawListBox(ctx, {
    x: collabX,
    y: tagsTop,
    w: boxW,
    h: 280,
    title: theme.t('analytics.collabs'),
    empty: theme.t('analytics.emptyTags'),
    rows: (page.collaborators || []).slice(0, 6).map((item) => ({
      label: item.key.startsWith('@') ? item.key : `@${item.key}`,
      meta: theme.t('analytics.times', { n: theme.n(item.count), er: theme.n(item.avgEngagement, 1) }),
      ltr: true,
    })),
    rtl,
    panel,
    line,
    ink,
    muted,
  })

  const hintsTop = tagsTop + 304
  roundRect(ctx, pad, hintsTop, W - pad * 2, 220, 22)
  ctx.fillStyle = panel
  ctx.fill()
  ctx.strokeStyle = line
  ctx.stroke()
  ctx.fillStyle = ink
  ctx.font = '700 18px Vazirmatn, sans-serif'
  fillUi(ctx, theme.t('analytics.posterHints'), startX, hintsTop + 36, rtl)
  ctx.font = '400 16px Vazirmatn, sans-serif'
  const hintLines = (page.hints || [])
    .slice(0, 5)
    .map((h) => {
      const args = { ...(h.args || {}) }
      if (typeof args.day === 'string') args.day = theme.weekday(args.day)
      return theme.t(`hints.${h.id}`, args)
    })
  if (!hintLines.length) {
    ctx.fillStyle = muted
    fillUi(ctx, theme.t('analytics.emptyTags'), startX, hintsTop + 70, rtl)
  } else {
    hintLines.forEach((line, i) => {
      wrapLines(ctx, `• ${line}`, W - pad * 2 - 40)
        .slice(0, 1)
        .forEach((w) => {
          ctx.fillStyle = ink
          fillUi(ctx, w, startX, hintsTop + 70 + i * 28, rtl)
        })
    })
  }

  const related = (page.relatedProfiles || []).slice(0, 6)
  const relTop = hintsTop + 244
  roundRect(ctx, pad, relTop, W - pad * 2, 150, 22)
  ctx.fillStyle = panel
  ctx.fill()
  ctx.strokeStyle = line
  ctx.stroke()
  ctx.fillStyle = ink
  ctx.font = '700 18px Vazirmatn, sans-serif'
  fillUi(ctx, theme.t('analytics.related'), startX, relTop + 36, rtl)
  ctx.font = '500 16px Vazirmatn, sans-serif'
  ctx.fillStyle = muted
  if (!related.length) {
    fillUi(ctx, theme.t('analytics.emptyTags'), startX, relTop + 70, rtl)
  } else {
    wrapLines(ctx, related.map((r) => `@${r.username}`).join('   '), W - pad * 2 - 40)
      .slice(0, 3)
      .forEach((line, i) => fillHandle(ctx, line, startX, relTop + 70 + i * 24, rtl))
  }

  ctx.font = '400 14px Vazirmatn, sans-serif'
  ctx.fillStyle = muted
  fillUi(ctx, theme.t('analytics.posterFooter', { date: theme.d(page.fetchedAt) }), startX, relTop + 186, rtl)

  const usedHeight = Math.min(2400, relTop + 230)
  const out = document.createElement('canvas')
  out.width = W * scale
  out.height = usedHeight * scale
  const outCtx = out.getContext('2d')
  if (!outCtx) throw new Error('canvas')
  outCtx.drawImage(canvas, 0, 0, W * scale, usedHeight * scale, 0, 0, W * scale, usedHeight * scale)

  const blob: Blob = await new Promise((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/png')
  })
  downloadBlob(`postyar-${page.handle}-analytics.png`, blob)
}
