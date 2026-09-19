import { Link } from 'react-router-dom'
import { useI18n } from '../prefs/PrefsProvider'

export function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  const { t } = useI18n()
  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>
      <div className="panel panel-pad">
        <p className="section-sub">{t('placeholder.body')}</p>
        <div className="form-actions">
          <Link to="/" className="btn btn-solid btn-sm">
            {t('nav.dashboard')}
          </Link>
          <Link to="/content" className="btn btn-outline btn-sm">
            {t('nav.content')}
          </Link>
        </div>
      </div>
    </div>
  )
}
