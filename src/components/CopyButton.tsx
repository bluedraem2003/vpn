import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../prefs/PrefsProvider'

interface CopyButtonProps {
  text: string
  label?: string
}

export function CopyButton({ text, label }: CopyButtonProps) {
  const { t } = useI18n()
  const [done, setDone] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      window.setTimeout(() => setDone(false), 1400)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setDone(true)
      window.setTimeout(() => setDone(false), 1400)
    }
  }

  return (
    <button type="button" className="btn btn-outline btn-sm" onClick={onCopy}>
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? t('common.copied') : label || t('common.copy')}
    </button>
  )
}
