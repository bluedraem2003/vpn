import type { Lang } from '../i18n/strings'

export function occasionLabel(o: { nameFa: string; nameEn?: string | null }, lang: Lang) {
  return lang === 'en' ? o.nameEn || o.nameFa : o.nameFa
}
