const TOKEN_KEY = 'rr_token'
const USER_KEY = 'rr_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearUser() {
  localStorage.removeItem(USER_KEY)
}

export function isLoggedIn() {
  return !!(getToken() && getUser())
}

export function logout() {
  clearToken()
  clearUser()
  window.location.href = '/login'
}

export async function apiFetch(url, opts = {}) {
  if (!opts.headers) opts.headers = {}
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.body = JSON.stringify(opts.body)
    if (!opts.headers['Content-Type']) {
      opts.headers['Content-Type'] = 'application/json'
    }
  }
  const token = getToken()
  if (token) {
    opts.headers['Authorization'] = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(url, opts)
  } catch (err) {
    throw new Error('Network error. Please check your connection.')
  }

  if (response.status === 401) {
    clearToken()
    clearUser()
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  return response
}
