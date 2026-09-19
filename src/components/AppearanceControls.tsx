import { Languages, Moon, Sun } from 'lucide-react'
import { useI18n } from '../prefs/PrefsProvider'

export function AppearanceControls({ compact = false }: { compact?: boolean }) {
  const { lang, theme, setLang, setTheme, t } = useI18n()
  return (
    <div className={`appearance-controls ${compact ? 'compact' : ''}`}>
      <div className="appearance-group" role="group" aria-label={t('settings.language')}>
        <Languages size={14} aria-hidden />
        <button
          type="button"
          className={lang === 'fa' ? 'active' : ''}
          aria-pressed={lang === 'fa'}
          onClick={() => setLang('fa')}
        >
          فا
        </button>
        <button
          type="button"
          className={lang === 'en' ? 'active' : ''}
          aria-pressed={lang === 'en'}
          onClick={() => setLang('en')}
        >
          EN
        </button>
      </div>
      <div className="appearance-group" role="group" aria-label={t('settings.theme')}>
        <button
          type="button"
          className={theme === 'light' ? 'active' : ''}
          aria-pressed={theme === 'light'}
          onClick={() => setTheme('light')}
          title={t('settings.light')}
          aria-label={t('settings.light')}
        >
          <Sun size={14} aria-hidden />
        </button>
        <button
          type="button"
          className={theme === 'dark' ? 'active' : ''}
          aria-pressed={theme === 'dark'}
          onClick={() => setTheme('dark')}
          title={t('settings.dark')}
          aria-label={t('settings.dark')}
        >
          <Moon size={14} aria-hidden />
        </button>
      </div>
    </div>
  )
}
