import { Languages, Moon, Sun } from 'lucide-react'
import { useI18n } from '../prefs/PrefsProvider'

export function AppearanceControls({ compact = false }: { compact?: boolean }) {
  const { lang, theme, setLang, setTheme, t } = useI18n()
  return (
    <div className={`appearance-controls ${compact ? 'compact' : ''}`}>
      <div className="appearance-group" role="group" aria-label={t('settings.language')}>
        <Languages size={14} aria-hidden />
        <button type="button" className={lang === 'fa' ? 'active' : ''} onClick={() => setLang('fa')}>
          فا
        </button>
        <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
          EN
        </button>
      </div>
      <div className="appearance-group" role="group" aria-label={t('settings.theme')}>
        <button
          type="button"
          className={theme === 'light' ? 'active' : ''}
          onClick={() => setTheme('light')}
          title={t('settings.light')}
        >
          <Sun size={14} />
        </button>
        <button
          type="button"
          className={theme === 'dark' ? 'active' : ''}
          onClick={() => setTheme('dark')}
          title={t('settings.dark')}
        >
          <Moon size={14} />
        </button>
      </div>
    </div>
  )
}
