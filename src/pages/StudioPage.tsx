import { useEffect, useState } from 'react'
import { localToday } from '../lib/dates'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import type { GenerateInput, GeneratedContent, InstagramPage, ViewId } from '../types'
import { generateContent } from '../lib/generator'
import { loadActivePageId, loadHistory, saveActivePageId, saveHistory } from '../lib/storage'
import { Hero } from '../components/Hero'
import { GeneratorForm } from '../components/GeneratorForm'
import { ResultPanel } from '../components/ResultPanel'
import { HistoryView } from '../components/HistoryView'
import { api, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { parseHashtags } from '../lib/hashtags'
import { useI18n } from '../prefs/PrefsProvider'

function mapProject(p: ProjectDto): InstagramPage {
  return {
    id: p.id,
    name: p.name,
    niche: p.niche || '',
    audience: p.audience || '',
    voice: p.voice || '',
    handle: p.handle || p.clientName || '',
    windowStart: p.windowStart || '',
    windowEnd: p.windowEnd || '',
    hashtags: p.hashtags || [],
    createdAt: Date.parse(p.createdAt) || Date.now(),
  }
}

const defaultInput: GenerateInput = {
  topic: '',
  format: 'feed',
  tone: 'friendly',
  language: 'fa',
  goal: '',
  includeEmoji: true,
  includeCta: true,
}

const nav: { id: ViewId; key: string }[] = [
  { id: 'studio', key: 'studio.navStudio' },
  { id: 'history', key: 'studio.navHistory' },
]

/** Caption studio — pages persist via /api/projects (same store as پیج‌ها) */
export function StudioPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { workspaceId } = useAuth()
  const [view, setView] = useState<ViewId>('studio')
  const [showHero, setShowHero] = useState(false)
  const [input, setInput] = useState<GenerateInput>(defaultInput)
  const [result, setResult] = useState<GeneratedContent | null>(null)
  const [busy, setBusy] = useState(false)
  const [pagesError, setPagesError] = useState<string | null>(null)
  const [pages, setPages] = useState<InstagramPage[]>([])
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [history, setHistory] = useState<GeneratedContent[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [calBusy, setCalBusy] = useState(false)
  const [calMsg, setCalMsg] = useState<string | null>(null)
  const [scheduleDate, setScheduleDate] = useState(() => localToday())

  async function reloadPages(id: string) {
    const res = await api.listProjects(id)
    const mapped = (res.items || []).map(mapProject)
    setPages(mapped)
    const saved = loadActivePageId()
    const nextActive = saved && mapped.some((p) => p.id === saved) ? saved : mapped[0]?.id ?? null
    setActivePageId(nextActive)
    saveActivePageId(nextActive)
  }

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  useEffect(() => {
    if (!workspaceId) return
    void reloadPages(workspaceId).catch((e) => setPagesError((e as Error).message))
  }, [workspaceId])

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 1800)
  }

  function selectPage(id: string) {
    setActivePageId(id)
    saveActivePageId(id)
  }

  function handleGenerate() {
    if (!input.topic.trim()) {
      notify(t('studio.needTopic'))
      return
    }
    setBusy(true)
    const page = pages.find((p) => p.id === activePageId)
    const generated = generateContent(input, {
      pageName: page?.name,
      niche: page?.niche || input.topic,
      voice: page?.voice,
    })
    setResult(generated)
    setHistory((prev) => {
      const nextHistory = [generated, ...prev].slice(0, 40)
      saveHistory(nextHistory)
      return nextHistory
    })
    setBusy(false)
    setShowHero(false)
    notify(t('studio.ready'))
  }

  async function saveToCalendar() {
    if (!workspaceId || !result) {
      notify(t('studio.needLogin'))
      return
    }
    setCalBusy(true)
    setCalMsg(null)
    const typeMap = { feed: 'post', reel: 'reel', story: 'story', carousel: 'carousel' } as const
    try {
      const page = pages.find((p) => p.id === activePageId)
      const tags = parseHashtags([...(result.hashtags || []), ...(page?.hashtags || [])])
      const captionTags = tags.slice(0, 30)
      const extraTags = tags.slice(30)
      const res = await api.createContent({
        workspaceId,
        title: result.input.topic.trim() || result.hook.slice(0, 80),
        contentType: typeMap[result.input.format] || 'post',
        platforms: ['instagram'],
        status: scheduleDate ? 'scheduled' : 'planned',
        publishDate: scheduleDate || undefined,
        publishTime: page?.windowStart || undefined,
        projectId: activePageId || undefined,
        caption: result.caption,
        hashtags: captionTags,
        firstComment: extraTags.join(' '),
        notes: [result.visualIdea, result.reelScript, result.carouselSlides?.map((s, i) => `${i + 1}. ${s}`).join('\n')]
          .filter(Boolean)
          .join('\n\n'),
        windowStart: page?.windowStart || undefined,
        windowEnd: page?.windowEnd || undefined,
      })
      setCalMsg(t('studio.sentCal'))
      notify(t('studio.sentContent'))
      navigate(`/content?edit=${res.item.id}`)
    } catch (e) {
      setCalMsg((e as Error).message)
    } finally {
      setCalBusy(false)
    }
  }

  return (
    <div className="studio-page">
      <div className="result-head studio-page-head" style={{ marginBottom: '1rem' }}>
        <div>
          <p className="ops-kicker">{t('nav.studio')}</p>
          <h2 className="section-title">{t('studio.title')}</h2>
          <p className="section-sub" style={{ marginBottom: 0 }}>
            {t('studio.sub')}
          </p>
        </div>
        <div className="form-actions" style={{ margin: 0 }}>
          <Link to="/projects" className="btn btn-outline btn-sm">
            {t('nav.projects')}
          </Link>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/calendar')}>
            {t('studio.toCalendar')}
          </button>
        </div>
      </div>

      <nav className="nav-pills" aria-label={t('studio.navAria')} style={{ marginBottom: '1rem', width: 'fit-content' }}>
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? 'active' : ''}
            onClick={() => {
              setView(item.id)
              if (item.id === 'studio') setShowHero(false)
            }}
          >
            {t(item.key)}
          </button>
        ))}
      </nav>

      {pagesError && <div className="form-banner error">{pagesError}</div>}

      {view === 'studio' && showHero && (
        <Hero
          onStart={() => setShowHero(false)}
          onIdeas={() => navigate('/ideas')}
        />
      )}

      {view === 'studio' && !showHero && (
        <motion.div
          className="studio-grid"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <GeneratorForm
            pages={pages}
            activePageId={activePageId}
            onSelectPage={selectPage}
            value={input}
            busy={busy}
            onChange={setInput}
            onGenerate={handleGenerate}
          />
          <ResultPanel
            result={result}
            onSaveToCalendar={() => void saveToCalendar()}
            saveBusy={calBusy}
            saveMsg={calMsg}
            scheduleDate={scheduleDate}
            onScheduleDateChange={setScheduleDate}
          />
        </motion.div>
      )}

      {view === 'history' && (
        <HistoryView
          items={history}
          onClear={() => {
            setHistory([])
            saveHistory([])
          }}
          onReuse={(item) => {
            setInput(item.input)
            setResult(item)
            setView('studio')
            setShowHero(false)
          }}
        />
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
