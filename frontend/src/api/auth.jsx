import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, getToken, getUser, setToken, setUser, clearToken, clearUser, isLoggedIn } from './client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => getUser())
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const restoreSession = useCallback(async () => {
    if (!isLoggedIn()) {
      setLoading(false)
      return
    }
    try {
      const res = await apiFetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        if (data.user) {
          setUser(data.user)
          setUserState(data.user)
        }
      } else {
        clearToken()
        clearUser()
        setUserState(null)
      }
    } catch {
      setUserState(getUser())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  const login = useCallback(async (email, password) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Invalid email or password')
    setToken(data.token)
    setUser(data.user)
    setUserState(data.user)
    navigate('/')
    return data
  }, [navigate])

  const register = useCallback(async (username, email, password) => {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: { username, email, password },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Registration failed')
    setToken(data.token)
    setUser(data.user)
    setUserState(data.user)
    navigate('/')
    return data
  }, [navigate])

  const logout = useCallback(() => {
    clearToken()
    clearUser()
    setUserState(null)
    navigate('/login')
  }, [navigate])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
