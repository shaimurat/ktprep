export type AuthUser = {
  id: string
  login: string
  role: 'user' | 'admin'
  createdAt: string
}

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

const authRequest = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}/api/auth/${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || 'Не удалось выполнить запрос.')
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export const getCurrentUser = () => authRequest<AuthUser>('me')
export const register = (login: string, password: string) =>
  authRequest<AuthUser>('register', { method: 'POST', body: JSON.stringify({ login, password }) })
export const login = (loginValue: string, password: string) =>
  authRequest<AuthUser>('login', { method: 'POST', body: JSON.stringify({ login: loginValue, password }) })
export const logout = () => authRequest<void>('logout', { method: 'POST' })
export const changePassword = (currentPassword: string, newPassword: string) =>
  authRequest<void>('password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
