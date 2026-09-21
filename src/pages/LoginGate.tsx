import { useEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'

/** Login UI is hidden for now. The owner session is opened automatically. */
export function LoginGate({ children }: { children: React.ReactNode }) {
  const { session, loading, login } = useAuth()
  const started = useRef(false)

  useEffect(() => {
    if (loading || session || started.current) return
    started.current = true
    void login('owner@postyar.local').catch(() => {
      started.current = false
    })
  }, [loading, session, login])

  if (!session) return null
  return <>{children}</>
}
