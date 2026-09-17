import type { GeneratedContent } from '../types'
import { CopyButton } from './CopyButton'
import { formatLabels, toneLabels } from '../lib/generator'
import { motion } from 'framer-motion'

interface ResultPanelProps {
  result: GeneratedContent | null
}

export function ResultPanel({ result }: ResultPanelProps) {
  if (!result) {
    return (
      <div className="panel panel-pad">
        <div className="empty">
          <strong>هنوز محتوایی ساخته نشده</strong>
          موضوع را وارد کن و دکمه تولید را بزن. خروجی اینجا نمایش داده می‌شود.
        </div>
      </div>
    )
  }

  const allText = [
    result.caption,
    '',
    result.hashtags.join(' '),
    result.reelScript ? `\n--- اسکریپت ریلز ---\n${result.reelScript}` : '',
    result.carouselSlides
      ? `\n--- اسلایدها ---\n${result.carouselSlides.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
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
            خروجی آماده
          </h2>
          <p className="section-sub" style={{ marginBottom: 0 }}>
            {formatLabels[result.input.format]} · {toneLabels[result.input.tone]}
            {result.pageName ? ` · ${result.pageName}` : ''}
          </p>
        </div>
        <CopyButton text={allText} label="کپی همه" />
      </div>

      <div className="result-block">
        <div className="result-head">
          <h3>هوک</h3>
          <CopyButton text={result.hook} />
        </div>
        <p className="pre">{result.hook}</p>
      </div>

      <div className="result-block">
        <div className="result-head">
          <h3>کپشن</h3>
          <CopyButton text={result.caption} />
        </div>
        <p className="pre">{result.caption}</p>
      </div>

      <div className="result-block">
        <div className="result-head">
          <h3>هشتگ‌ها</h3>
          <CopyButton text={result.hashtags.join(' ')} />
        </div>
        <div className="tags">
          {result.hashtags.map((t) => (
            <span className="tag" key={t}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="result-block">
        <div className="result-head">
          <h3>ایده بصری</h3>
          <CopyButton text={result.visualIdea} />
        </div>
        <p className="pre">{result.visualIdea}</p>
      </div>

      {result.reelScript && (
        <div className="result-block">
          <div className="result-head">
            <h3>اسکریپت ریلز</h3>
            <CopyButton text={result.reelScript} />
          </div>
          <p className="pre">{result.reelScript}</p>
        </div>
      )}

      {result.carouselSlides && (
        <div className="result-block">
          <div className="result-head">
            <h3>ساختار کاروسل</h3>
            <CopyButton text={result.carouselSlides.map((s, i) => `${i + 1}. ${s}`).join('\n')} />
          </div>
          <p className="pre">{result.carouselSlides.map((s, i) => `${i + 1}. ${s}`).join('\n')}</p>
        </div>
      )}

      <div className="result-block">
        <div className="result-head">
          <h3>نسخه‌های جایگزین</h3>
        </div>
        {result.altCaptions.map((alt, i) => (
          <div key={i} style={{ marginBottom: i === 0 ? '0.85rem' : 0 }}>
            <div className="result-head">
              <h3>نسخه {i + 2}</h3>
              <CopyButton text={alt} />
            </div>
            <p className="pre">{alt}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
