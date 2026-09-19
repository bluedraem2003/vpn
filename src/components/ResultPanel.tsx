import type { GeneratedContent } from '../types'
import { CopyButton } from './CopyButton'
import { IG_CAPTION_LIMIT, IG_HASHTAG_LIMIT, parseHashtags } from '../lib/hashtags'
import { formatJalaliFromIso } from '../lib/jalaali'
import { motion } from 'framer-motion'
import { useI18n } from '../prefs/PrefsProvider'

interface ResultPanelProps {
  result: GeneratedContent | null
  onSaveToCalendar?: () => void
  saveBusy?: boolean
  saveMsg?: string | null
  scheduleDate?: string
  onScheduleDateChange?: (value: string) => void
}

export function ResultPanel({
  result,
  onSaveToCalendar,
  saveBusy,
  saveMsg,
  scheduleDate,
  onScheduleDateChange,
}: ResultPanelProps) {
  const { t, lang } = useI18n()
  if (!result) {
    return (
      <div className="panel panel-pad">
        <div className="empty">
          <strong>{t('studio.emptyTitle')}</strong>
          {t('studio.emptySub')}
        </div>
      </div>
    )
  }

  const allText = [
    result.caption,
    '',
    result.hashtags.join(' '),
    result.reelScript ? `\n--- ${t('studio.reelBlock')} ---\n${result.reelScript}` : '',
    result.carouselSlides
      ? `\n--- ${t('studio.slidesBlock')} ---\n${result.carouselSlides.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <motion.div
      className="panel panel-pad"
      key={result.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="result-head" style={{ marginBottom: '1rem' }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>
            {t('studio.resultTitle')}
          </h2>
          <p className="section-sub" style={{ marginBottom: 0 }}>
            {t(`format.${result.input.format}`)} · {t(`tone.${result.input.tone}`)}
            {result.pageName ? ` · ${result.pageName}` : ''}
          </p>
        </div>
        <div className="form-actions">
          <CopyButton text={allText} label={t('studio.copyAll')} />
        </div>
      </div>
      {onSaveToCalendar && (
        <div className="studio-schedule">
          <div className="field" style={{ margin: 0 }}>
            <label>{t('studio.publishDate')}</label>
            <input
              type="date"
              value={scheduleDate || ''}
              onChange={(e) => onScheduleDateChange?.(e.target.value)}
            />
            {scheduleDate && lang === 'fa' ? (
              <span className="field-hint">{t('studio.jalali', { date: formatJalaliFromIso(scheduleDate) })}</span>
            ) : null}
          </div>
          <button type="button" className="btn btn-solid" disabled={saveBusy} onClick={onSaveToCalendar}>
            {saveBusy ? t('studio.sending') : scheduleDate ? t('studio.sendDated') : t('studio.saveNoDate')}
          </button>
        </div>
      )}
      {saveMsg && <p className="form-banner ok">{saveMsg}</p>}

      <div className="result-block">
        <div className="result-head">
          <h3>{t('studio.hook')}</h3>
          <CopyButton text={result.hook} />
        </div>
        <p className="pre">{result.hook}</p>
      </div>

      <div className="result-block">
        <div className="result-head">
          <h3>{t('studio.caption')}</h3>
          <CopyButton text={result.caption} />
        </div>
        <p className="pre">{result.caption}</p>
        <span className={`field-hint ${result.caption.length > IG_CAPTION_LIMIT ? 'warn' : ''}`}>
          {t('studio.chars', { n: result.caption.length, max: IG_CAPTION_LIMIT })}
        </span>
      </div>

      <div className="result-block">
        <div className="result-head">
          <h3>{t('studio.hashtags')}</h3>
          <CopyButton text={result.hashtags.join(' ')} />
        </div>
        <span className={`field-hint ${parseHashtags(result.hashtags).length > IG_HASHTAG_LIMIT ? 'warn' : ''}`}>
          {t('studio.tagsCount', { n: parseHashtags(result.hashtags).length, max: IG_HASHTAG_LIMIT })}
        </span>
        <div className="tags">
          {result.hashtags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="result-block">
        <div className="result-head">
          <h3>{t('studio.visual')}</h3>
          <CopyButton text={result.visualIdea} />
        </div>
        <p className="pre">{result.visualIdea}</p>
      </div>

      {result.reelScript && (
        <div className="result-block">
          <div className="result-head">
            <h3>{t('studio.reelScript')}</h3>
            <CopyButton text={result.reelScript} />
          </div>
          <p className="pre">{result.reelScript}</p>
        </div>
      )}

      {result.carouselSlides && (
        <div className="result-block">
          <div className="result-head">
            <h3>{t('studio.carousel')}</h3>
            <CopyButton text={result.carouselSlides.map((s, i) => `${i + 1}. ${s}`).join('\n')} />
          </div>
          <p className="pre">{result.carouselSlides.map((s, i) => `${i + 1}. ${s}`).join('\n')}</p>
        </div>
      )}

      <div className="result-block">
        <div className="result-head">
          <h3>{t('studio.alts')}</h3>
        </div>
        {result.altCaptions.map((alt, i) => (
          <div key={i} style={{ marginBottom: i === 0 ? '0.85rem' : 0 }}>
            <div className="result-head">
              <h3>{t('studio.version', { n: i + 2 })}</h3>
              <CopyButton text={alt} />
            </div>
            <p className="pre">{alt}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
