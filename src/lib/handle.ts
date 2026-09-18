export function normalizeHandle(raw: string) {
  return raw.trim().replace(/^@+/, '')
}
