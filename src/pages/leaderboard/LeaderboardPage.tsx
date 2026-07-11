import { useEffect, useState } from 'react'
import { Crown } from 'lucide-react'
import { loadLeaderboard, type LeaderboardUser } from '../../services/leaderboard'
import type { AuthUser } from '../../services/auth'

type Period = 'all' | 'week' | 'month'

export function LeaderboardPage({ currentUser }: { currentUser: AuthUser }) {
  const [period, setPeriod] = useState<Period>('all')
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [error, setError] = useState('')

  useEffect(() => { loadLeaderboard(period).then(setUsers).catch((requestError) => setError(requestError.message)) }, [period])

  return <section className="leaderboard-page">
    <div className="analytics-heading"><div><p className="eyebrow">Соревнование</p><h1>Рейтинг</h1><p>Место определяется количеством правильных ответов.</p></div></div>
    <div className="leaderboard-tabs" role="tablist">{([{ id: 'all', label: 'Общий' }, { id: 'week', label: 'Неделя' }, { id: 'month', label: 'Месяц' }] as const).map((item) => <button key={item.id} type="button" role="tab" aria-selected={period === item.id} className={period === item.id ? 'is-active' : ''} onClick={() => setPeriod(item.id)}>{item.label}</button>)}</div>
    {error && <p className="auth-error">{error}</p>}
    <section className="leaderboard-list">
      {users.map((user) => <article className={`leaderboard-row ${user.id === currentUser.id ? 'is-current' : ''}`} key={user.id}>
        <strong className="leaderboard-rank">{user.rank <= 3 ? <Crown size={20} /> : user.rank}</strong>
        {user.avatarUrl ? <img className="leaderboard-avatar" src={user.avatarUrl} alt="" /> : <span className="leaderboard-avatar">{(user.displayName || user.login).slice(0, 1).toUpperCase()}</span>}
        <div><strong>{user.displayName || user.login}</strong><small>{user.attempts} попыток · средний {user.average}%</small></div>
        <b>{user.points} <small>баллов</small></b>
      </article>)}
      {!users.length && !error && <p className="muted">Рейтинг появится после первых завершённых тестов.</p>}
    </section>
  </section>
}
