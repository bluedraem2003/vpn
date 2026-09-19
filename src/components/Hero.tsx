import { motion } from 'framer-motion'
import { Sparkles, ArrowLeft, ArrowRight } from 'lucide-react'
import { useI18n } from '../prefs/PrefsProvider'

interface HeroProps {
  onStart: () => void
  onIdeas: () => void
}

export function Hero({ onStart, onIdeas }: HeroProps) {
  const { t, lang } = useI18n()
  return (
    <section className="hero" aria-label={t('studio.heroAria')}>
      <motion.div
        className="hero-media"
        initial={{ scale: 1.08, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="hero-content"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15 }}
      >
        <p className="brand-hero">{t('brand')}</p>
        <h2>{t('studio.heroTitle')}</h2>
        <p>{t('studio.heroSub')}</p>
        <div className="cta-row">
          <button type="button" className="btn btn-primary" onClick={onStart}>
            <Sparkles size={18} />
            {t('studio.start')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onIdeas}>
            {t('studio.weekly')}
            {lang === 'fa' ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
          </button>
        </div>
      </motion.div>
    </section>
  )
}
