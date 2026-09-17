import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'

const TOKEN_KEY = 'postyar_session_token'

type Session = {
  token: string
  user: { id: string; email: string; name: string }
  workspaceId: string
  role: string
}

type AuthContextValue = {
  session: Session | null
  loading: boolean
  error: string | null
  login: (email?: string) => Promise<void>
  logout: () => Promise<void>
  workspaceId: string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hydrate = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    try {
      api.setToken(token)
      const me = await api.me()
      setSession({
        token,
        user: me.user,
        workspaceId: me.workspaceId,
        role: me.role,
      })
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      api.setToken(null)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const login = useCallback(async (email?: string) => {
    setError(null)
    const res = await api.login(email)
    localStorage.setItem(TOKEN_KEY, res.token)
    api.setToken(res.token)
    setSession({
      token: res.token,
      user: res.user,
      workspaceId: res.workspaceId,
      role: res.role,
    })
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* ignore */
    }
    localStorage.removeItem(TOKEN_KEY)
    api.setToken(null)
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      loading,
      error,
      login,
      logout,
      workspaceId: session?.workspaceId ?? null,
    }),
    [session, loading, error, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
