import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteUser, grantTestAttempt, loadUsers, resetUserPassword, updateRole } from '../../services/admin'
import type { AuthUser } from '../../services/auth'

export function AdminPage({ currentUser }: { currentUser: AuthUser }) {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [error, setError] = useState('')
  const [passwords, setPasswords] = useState<Record<string, string>>({})

  const refresh = () => loadUsers().then(setUsers).catch((requestError) => setError(requestError.message))
  useEffect(() => { refresh() }, [])

  const action = async (work: () => Promise<unknown>) => {
    setError('')
    try { await work(); await refresh() } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Ошибка операции.') }
  }

  return <section className="admin-page">
    <p className="eyebrow">Управление доступом</p>
    <h1>Пользователи</h1>
    <p className="muted">Пароли не показываются: здесь можно только назначить новый пароль.</p>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <div className="admin-users">
      {users.map((user) => {
        const isSelf = user.id === currentUser.id
        return <article className="panel admin-user" key={user.id}>
          <div><strong>{user.login}</strong><small>Зарегистрирован: {new Date(user.createdAt).toLocaleDateString('ru-RU')}</small><small>Доступно попыток: {user.attemptsRemaining}</small></div>
          <label>Роль<select value={user.role} disabled={isSelf} onChange={(event) => action(() => updateRole(user.id, event.target.value as AuthUser['role']))}><option value="user">Пользователь</option><option value="admin">Администратор</option></select></label>
          <label>Новый пароль<input type="password" value={passwords[user.id] ?? ''} minLength={6} placeholder="Минимум 6 символов" onChange={(event) => setPasswords({ ...passwords, [user.id]: event.target.value })} /></label>
          <button className="secondary-button" type="button" onClick={() => action(async () => { await resetUserPassword(user.id, passwords[user.id] ?? ''); setPasswords({ ...passwords, [user.id]: '' }) })}>Сбросить пароль</button>
          <button className="primary-button" type="button" onClick={() => action(() => grantTestAttempt(user.id))}>Открыть пересдачу</button>
          <button className="danger-button" type="button" disabled={isSelf} onClick={() => { if (window.confirm(`Удалить аккаунт ${user.login}?`)) action(() => deleteUser(user.id)) }}><Trash2 size={17} /> Удалить</button>
        </article>
      })}
    </div>
    {!users.length && !error && <p className="muted">Загрузка пользователей…</p>}
  </section>
}
