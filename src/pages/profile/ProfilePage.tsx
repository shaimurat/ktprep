import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { changePassword, type AuthUser } from '../../services/auth'

export function ProfilePage({ user }: { user: AuthUser }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setMessage('Пароль успешно изменён.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сменить пароль.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="profile-page">
    <p className="eyebrow">Мой аккаунт</p>
    <h1>Профиль</h1>
    <p className="muted">Логин: <strong>{user.login}</strong> · Роль: <strong>{user.role === 'admin' ? 'Администратор' : 'Пользователь'}</strong></p>
    <form className="panel password-form" onSubmit={submit}>
      <h2><KeyRound size={21} /> Сменить пароль</h2>
      <label>Текущий пароль<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label>
      <label>Новый пароль<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={6} required /></label>
      <small className="muted">Минимум 6 символов.</small>
      {message && <p className={message.startsWith('Пароль успешно') ? 'success-message' : 'auth-error'}>{message}</p>}
      <button className="primary-button" disabled={saving}>{saving ? 'Сохранение…' : 'Сменить пароль'}</button>
    </form>
  </section>
}
