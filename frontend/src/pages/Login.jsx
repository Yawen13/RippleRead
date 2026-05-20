import { useState, useEffect } from 'react'
import { useAuth } from '../api/auth'

export default function Login() {
  const { login, register, isAuthenticated } = useAuth()
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPw, setShowLoginPw] = useState(false)

  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [showRegPw, setShowRegPw] = useState(false)

  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/'
    }
  }, [isAuthenticated])

  function showToast(msg, type = 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  function validateLogin() {
    const errs = {}
    if (!loginEmail.trim()) errs.loginEmail = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) errs.loginEmail = 'Please enter a valid email.'
    if (!loginPassword) errs.loginPassword = 'Password is required.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateRegister() {
    const errs = {}
    if (!regUsername.trim()) errs.regUsername = 'Username is required.'
    else if (regUsername.trim().length < 3) errs.regUsername = 'Username must be at least 3 characters.'
    if (!regEmail.trim()) errs.regEmail = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) errs.regEmail = 'Please enter a valid email.'
    if (!regPassword) errs.regPassword = 'Password is required.'
    else if (regPassword.length < 8) errs.regPassword = 'Password must be at least 8 characters.'
    else if (!/[a-zA-Z]/.test(regPassword) || !/[0-9]/.test(regPassword)) errs.regPassword = 'Password must contain both letters and numbers.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!validateLogin()) return
    setLoading(true)
    try {
      await login(loginEmail.trim(), loginPassword)
    } catch (err) {
      showToast(err.message)
      setErrors(prev => ({ ...prev, loginEmail: err.message, loginPassword: '' }))
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (!validateRegister()) return
    setLoading(true)
    try {
      await register(regUsername.trim(), regEmail.trim(), regPassword)
    } catch (err) {
      showToast(err.message)
      const msg = err.message.toLowerCase()
      if (msg.includes('email')) setErrors(prev => ({ ...prev, regEmail: err.message }))
      else if (msg.includes('username')) setErrors(prev => ({ ...prev, regUsername: err.message }))
      else setErrors(prev => ({ ...prev, regEmail: err.message }))
    } finally {
      setLoading(false)
    }
  }

  function clearError(field) {
    setErrors(prev => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-sky-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold font-serif">R</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-gray-900">RippleRead</h1>
          <p className="text-gray-500 mt-1 font-sans text-sm">Your English reading companion</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {mode === 'login' ? (
            <form onSubmit={handleLogin}>
              <h2 className="font-serif text-xl font-bold text-gray-900 mb-6">Sign In</h2>

              <div className="mb-4">
                <label htmlFor="loginEmail" className="block text-sm font-medium text-gray-700 mb-1.5 font-sans">Email</label>
                <input
                  id="loginEmail"
                  type="email"
                  className={`w-full px-4 py-2.5 rounded-xl border ${errors.loginEmail ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-teal-400 font-sans text-sm transition-colors`}
                  value={loginEmail}
                  onChange={e => { setLoginEmail(e.target.value); clearError('loginEmail') }}
                  placeholder="your@email.com"
                  autoComplete="email"
                />
                {errors.loginEmail && <p className="text-red-500 text-xs mt-1 font-sans">{errors.loginEmail}</p>}
              </div>

              <div className="mb-6">
                <label htmlFor="loginPassword" className="block text-sm font-medium text-gray-700 mb-1.5 font-sans">Password</label>
                <div className="relative">
                  <input
                    id="loginPassword"
                    type={showLoginPw ? 'text' : 'password'}
                    className={`w-full px-4 py-2.5 rounded-xl border ${errors.loginPassword ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-teal-400 font-sans text-sm transition-colors pr-12`}
                    value={loginPassword}
                    onChange={e => { setLoginPassword(e.target.value); clearError('loginPassword') }}
                    placeholder="Enter password"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowLoginPw(!showLoginPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-0 cursor-pointer">
                    {showLoginPw ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                {errors.loginPassword && <p className="text-red-500 text-xs mt-1 font-sans">{errors.loginPassword}</p>}
              </div>

              <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-sans font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-60">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <p className="text-center mt-6 text-sm text-gray-500 font-sans">
                Don't have an account?{' '}
                <button type="button" onClick={() => { setMode('register'); setErrors({}); setToast(null) }} className="text-teal-600 font-semibold hover:underline bg-transparent border-0 cursor-pointer">
                  Create Account
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <h2 className="font-serif text-xl font-bold text-gray-900 mb-6">Create Account</h2>

              <div className="mb-4">
                <label htmlFor="regUsername" className="block text-sm font-medium text-gray-700 mb-1.5 font-sans">Username</label>
                <input
                  id="regUsername"
                  type="text"
                  className={`w-full px-4 py-2.5 rounded-xl border ${errors.regUsername ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-teal-400 font-sans text-sm transition-colors`}
                  value={regUsername}
                  onChange={e => { setRegUsername(e.target.value); clearError('regUsername') }}
                  placeholder="Choose a username"
                  autoComplete="username"
                />
                {errors.regUsername && <p className="text-red-500 text-xs mt-1 font-sans">{errors.regUsername}</p>}
              </div>

              <div className="mb-4">
                <label htmlFor="regEmail" className="block text-sm font-medium text-gray-700 mb-1.5 font-sans">Email</label>
                <input
                  id="regEmail"
                  type="email"
                  className={`w-full px-4 py-2.5 rounded-xl border ${errors.regEmail ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-teal-400 font-sans text-sm transition-colors`}
                  value={regEmail}
                  onChange={e => { setRegEmail(e.target.value); clearError('regEmail') }}
                  placeholder="your@email.com"
                  autoComplete="email"
                />
                {errors.regEmail && <p className="text-red-500 text-xs mt-1 font-sans">{errors.regEmail}</p>}
              </div>

              <div className="mb-6">
                <label htmlFor="regPassword" className="block text-sm font-medium text-gray-700 mb-1.5 font-sans">Password</label>
                <div className="relative">
                  <input
                    id="regPassword"
                    type={showRegPw ? 'text' : 'password'}
                    className={`w-full px-4 py-2.5 rounded-xl border ${errors.regPassword ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-teal-400 font-sans text-sm transition-colors pr-12`}
                    value={regPassword}
                    onChange={e => { setRegPassword(e.target.value); clearError('regPassword') }}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowRegPw(!showRegPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-0 cursor-pointer">
                    {showRegPw ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                {errors.regPassword && <p className="text-red-500 text-xs mt-1 font-sans">{errors.regPassword}</p>}
              </div>

              <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-sans font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-60">
                {loading ? 'Creating account...' : 'Create Account'}
              </button>

              <p className="text-center mt-6 text-sm text-gray-500 font-sans">
                Already have an account?{' '}
                <button type="button" onClick={() => { setMode('login'); setErrors({}); setToast(null) }} className="text-teal-600 font-semibold hover:underline bg-transparent border-0 cursor-pointer">
                  Sign In
                </button>
              </p>
            </form>
          )}
        </div>

        {toast && (
          <div className={`mt-4 p-3 rounded-xl text-sm font-sans text-center ${toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  )
}
