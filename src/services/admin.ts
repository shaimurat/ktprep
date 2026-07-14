import type { AuthUser } from './auth'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}/api/admin/${path}`, {
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

export const loadUsers = () => request<AuthUser[]>('users')
export const updateRole = (id: string, role: AuthUser['role']) => request<AuthUser>(`users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) })
export const resetUserPassword = (id: string, newPassword: string) => request<void>(`users/${id}/password`, { method: 'POST', body: JSON.stringify({ newPassword }) })
export const grantTestAttempt = (id: string) => request<AuthUser>(`users/${id}/attempts`, { method: 'POST' })
export const deleteUser = (id: string) => request<void>(`users/${id}`, { method: 'DELETE' })
