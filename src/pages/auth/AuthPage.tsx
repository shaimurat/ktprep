import { useState } from 'react'
import { GraduationCap, LogIn, UserPlus } from 'lucide-react'
import { login, register, type AuthUser } from '../../services/auth'

export function AuthPage({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const user = mode === 'login' ? await login(loginValue, password) : await register(loginValue, password)
      onAuthenticated(user)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось выполнить запрос.')
    } finally {
      setLoading(false)
    }
  }

  const isRegistration = mode === 'register'
  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo"><GraduationCap size={30} /></div>
        <p className="eyebrow">KT Prep Trainer</p>
        <h1>{isRegistration ? 'Создать аккаунт' : 'С возвращением'}</h1>
        <p>{isRegistration ? 'Сохраняйте свою статистику и прогресс.' : 'Войдите, чтобы продолжить подготовку.'}</p>
        <label>Логин
          <input value={loginValue} onChange={(event) => setLoginValue(event.target.value)} autoComplete="username" minLength={3} maxLength={64} required />
        </label>
        <label>Пароль
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isRegistration ? 'new-password' : 'current-password'} minLength={6} required />
        </label>
        {isRegistration && <small className="auth-hint">Минимум 6 символов.</small>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary-button full" disabled={loading}>
          {isRegistration ? <UserPlus size={18} /> : <LogIn size={18} />} {loading ? 'Подождите…' : isRegistration ? 'Зарегистрироваться' : 'Войти'}
        </button>
        <button className="auth-switch" type="button" onClick={() => { setMode(isRegistration ? 'login' : 'register'); setError('') }}>
          {isRegistration ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </button>
      </form>
    </main>
  )
}
