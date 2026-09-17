import { motion } from 'framer-motion'
import { Sparkles, ArrowLeft } from 'lucide-react'

interface HeroProps {
  onStart: () => void
  onIdeas: () => void
}

export function Hero({ onStart, onIdeas }: HeroProps) {
  return (
    <section className="hero" aria-label="معرفی پست‌یار">
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
        <p className="brand-hero">پست‌یار</p>
        <h2>استودیوی مینیمال تولید محتوای اینستاگرام</h2>
        <p>
          کپشن، هوک، هشتگ، اسکریپت ریلز و ایده کاروسل را در چند ثانیه برای پیج‌هایت بساز؛
          ساده، مرتب و آماده انتشار.
        </p>
        <div className="cta-row">
          <button type="button" className="btn btn-primary" onClick={onStart}>
            <Sparkles size={18} />
            شروع تولید محتوا
          </button>
          <button type="button" className="btn btn-ghost" onClick={onIdeas}>
            تقویم هفتگی
            <ArrowLeft size={16} />
          </button>
        </div>
      </motion.div>
    </section>
  )
}
