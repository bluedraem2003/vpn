import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { GenerateInput, GeneratedContent, InstagramPage, ViewId } from '../types'
import { generateContent } from '../lib/generator'
import { loadActivePageId, loadHistory, saveActivePageId, saveHistory } from '../lib/storage'
import { Hero } from '../components/Hero'
import { GeneratorForm } from '../components/GeneratorForm'
import { ResultPanel } from '../components/ResultPanel'
import { PagesView, type PageFormInput } from '../components/PagesView'
import { HistoryView } from '../components/HistoryView'
import { IdeasView } from '../components/IdeasView'
import { api, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'

function mapProject(p: ProjectDto): InstagramPage {
  return {
    id: p.id,
    name: p.name,
    niche: p.niche || '',
    audience: p.audience || '',
    voice: p.voice || '',
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

const nav: { id: ViewId; label: string }[] = [
  { id: 'studio', label: 'استودیو' },
  { id: 'pages', label: 'پیج‌ها' },
  { id: 'ideas', label: 'ایده‌ها' },
  { id: 'history', label: 'تاریخچه' },
]

/** Caption studio — pages persist via /api/projects (same store as پیج‌ها) */
export function StudioPage() {
  const navigate = useNavigate()
  const { workspaceId } = useAuth()
  const [view, setView] = useState<ViewId>('studio')
  const [showHero, setShowHero] = useState(false)
  const [input, setInput] = useState<GenerateInput>(defaultInput)
  const [result, setResult] = useState<GeneratedContent | null>(null)
  const [busy, setBusy] = useState(false)
  const [pagesBusy, setPagesBusy] = useState(false)
  const [pagesError, setPagesError] = useState<string | null>(null)
  const [pages, setPages] = useState<InstagramPage[]>([])
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [history, setHistory] = useState<GeneratedContent[]>([])
  const [toast, setToast] = useState<string | null>(null)

  async function reloadPages(id: string) {
    const res = await api.listProjects(id)
    const mapped = res.items.map(mapProject)
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

  async function createPage(form: PageFormInput) {
    if (!workspaceId) {
      setPagesError('وارد حساب نشده‌اید')
      return
    }
    setPagesBusy(true)
    setPagesError(null)
    try {
      const res = await api.createProject({
        workspaceId,
        name: form.name,
        niche: form.niche || undefined,
        audience: form.audience || undefined,
        voice: form.voice || undefined,
      })
      await reloadPages(workspaceId)
      selectPage(res.item.id)
      notify('پیج ذخیره شد')
    } catch (e) {
      setPagesError((e as Error).message)
    } finally {
      setPagesBusy(false)
    }
  }

  async function removePage(id: string) {
    if (!workspaceId) return
    setPagesBusy(true)
    setPagesError(null)
    try {
      await api.deleteProject(id)
      await reloadPages(workspaceId)
      notify('پیج حذف شد')
    } catch (e) {
      setPagesError((e as Error).message)
    } finally {
      setPagesBusy(false)
    }
  }

  function handleGenerate() {
    if (!input.topic.trim()) {
      notify('لطفاً موضوع محتوا را بنویس')
      return
    }
    setBusy(true)
    window.setTimeout(() => {
      const page = pages.find((p) => p.id === activePageId)
      const generated = generateContent(input, {
        pageName: page?.name,
        niche: page?.niche || input.topic,
        voice: page?.voice,
      })
      setResult(generated)
      const nextHistory = [generated, ...history].slice(0, 40)
      setHistory(nextHistory)
      saveHistory(nextHistory)
      setBusy(false)
      setShowHero(false)
      notify('محتوا آماده شد')
    }, 420)
  }

  return (
    <div className="studio-page">
      <div className="result-head" style={{ marginBottom: '1rem' }}>
        <div>
          <h2 className="section-title">استودیوی کپشن</h2>
          <p className="section-sub" style={{ marginBottom: 0 }}>
            تولید سریع کپشن و هوک — ماژول قبلی پست‌یار بدون تغییر رفتار
          </p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/calendar')}>
          برو به تقویم
        </button>
      </div>

      <nav className="nav-pills" aria-label="زیرمنوی استودیو" style={{ marginBottom: '1rem', width: 'fit-content' }}>
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
            {item.label}
          </button>
        ))}
      </nav>

      {view === 'studio' && showHero && (
        <Hero
          onStart={() => setShowHero(false)}
          onIdeas={() => {
            setShowHero(false)
            setView('ideas')
          }}
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
            value={input}
            busy={busy}
            onChange={setInput}
            onGenerate={handleGenerate}
          />
          <ResultPanel result={result} />
        </motion.div>
      )}

      {view === 'pages' && (
        <PagesView
          pages={pages}
          activePageId={activePageId}
          busy={pagesBusy}
          error={pagesError}
          onCreate={createPage}
          onRemove={removePage}
          onSelect={selectPage}
        />
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

      {view === 'ideas' && (
        <IdeasView
          onUseIdea={(topic, format) => {
            setInput({ ...input, topic, format })
            setView('studio')
            setShowHero(false)
            notify('ایده به استودیو منتقل شد')
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
