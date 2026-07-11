export type LeaderboardUser = {
  id: string
  login: string
  displayName: string | null
  avatarUrl: string | null
  attempts: number
  points: number
  average: number
  rank: number
}

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export const loadLeaderboard = async (period: 'all' | 'week' | 'month') => {
  const response = await fetch(`${API_URL}/api/leaderboard?period=${period}`)
  if (!response.ok) throw new Error('Не удалось загрузить рейтинг.')
  return response.json() as Promise<LeaderboardUser[]>
}
