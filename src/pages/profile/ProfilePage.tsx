import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { changePassword, updateProfile, type AuthUser } from '../../services/auth'
import { SUBJECTS } from '../../models/subjects'

export function ProfilePage({ user, onUserUpdate }: { user: AuthUser; onUserUpdate: (user: AuthUser) => void }) {
  const [displayName, setDisplayName] = useState(user.displayName ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '')
  const [goalScore, setGoalScore] = useState(user.goalScore ?? 100)
  const [selectedSubjects, setSelectedSubjects] = useState(user.selectedSubjects)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const submitProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const updatedUser = await updateProfile({ displayName, avatarUrl, goalScore, selectedSubjects })
      setMessage('Профиль сохранён.')
      onUserUpdate(updatedUser)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить профиль.')
    } finally {
      setSaving(false)
    }
  }

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
    <form className="panel profile-form" onSubmit={submitProfile}>
      <h2>Данные профиля</h2>
      <label>Имя<input value={displayName} maxLength={50} placeholder="Как тебя показывать в рейтинге" onChange={(event) => setDisplayName(event.target.value)} /></label>
      <label>Ссылка на аватар<input type="url" value={avatarUrl} placeholder="https://..." onChange={(event) => setAvatarUrl(event.target.value)} /></label>
      <label>Цель по баллам<input type="number" min={0} max={140} value={goalScore} onChange={(event) => setGoalScore(Number(event.target.value))} /></label>
      <fieldset className="subject-choice"><legend>Мои предметы</legend>{SUBJECTS.map((subject) => <label key={subject.id}><input type="checkbox" checked={selectedSubjects.includes(subject.id)} onChange={() => setSelectedSubjects(selectedSubjects.includes(subject.id) ? selectedSubjects.filter((item) => item !== subject.id) : [...selectedSubjects, subject.id])} />{subject.title}</label>)}</fieldset>
      <button className="primary-button" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить профиль'}</button>
    </form>
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
