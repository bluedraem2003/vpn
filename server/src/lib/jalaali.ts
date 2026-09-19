/** Minimal Jalali ↔ Gregorian conversion (algorithm based on jalaali-js). */

export function toGregorian(jy: number, jm: number, jd: number) {
  const gy = jy <= 979 ? 621 : 1600
  jy -= jy <= 979 ? 0 : 979
  let days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186)
  let gy2 = gy + 400 * Math.floor(days / 146097)
  days %= 146097
  if (days > 36524) {
    gy2 += 100 * Math.floor(--days / 36524)
    days %= 36524
    if (days >= 365) days++
  }
  gy2 += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) {
    gy2 += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  let gd = days + 1
  const sal_a = [
    0,
    31,
    (gy2 % 4 === 0 && gy2 % 100 !== 0) || gy2 % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]
  let gm = 0
  for (gm = 1; gm <= 12 && gd > sal_a[gm]!; gm++) gd -= sal_a[gm]!
  return { gy: gy2, gm, gd }
}

export function toJalali(gy: number, gm: number, gd: number) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  let jy = gy <= 1600 ? 0 : 979
  gy -= gy <= 1600 ? 621 : 1600
  const gy2 = gm > 2 ? gy + 1 : gy
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1]!
  jy += 33 * Math.floor(days / 12053)
  days %= 12053
  jy += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) {
    jy += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30)
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30)
  return { jy, jm, jd }
}

export function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Resolve occasion month/day in a given Gregorian year → YYYY-MM-DD */
export function occasionDateInYear(
  calendar: 'jalali' | 'gregorian',
  month: number,
  day: number,
  gregorianYear: number,
): string | null {
  if (calendar === 'gregorian') {
    const dt = new Date(Date.UTC(gregorianYear, month - 1, day))
    if (dt.getUTCMonth() !== month - 1) return null
    return `${gregorianYear}-${pad2(month)}-${pad2(day)}`
  }
  // Approximate: map jalali year overlapping this gregorian year (Mar–Mar)
  const jy = gregorianYear - 621
  try {
    const { gy, gm, gd } = toGregorian(jy, month, day)
    if (gy !== gregorianYear) {
      // try adjacent jalali year
      const alt = toGregorian(jy - 1, month, day)
      if (alt.gy === gregorianYear) return `${alt.gy}-${pad2(alt.gm)}-${pad2(alt.gd)}`
      const alt2 = toGregorian(jy + 1, month, day)
      if (alt2.gy === gregorianYear) return `${alt2.gy}-${pad2(alt2.gm)}-${pad2(alt2.gd)}`
    }
    return `${gy}-${pad2(gm)}-${pad2(gd)}`
  } catch {
    return null
  }
}
