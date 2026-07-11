import type { ReactNode } from 'react'
import {
  BarChart3,
  BookOpen,
  GraduationCap,
  Home,
  Layers3,
  LogOut,
  ListChecks,
  Moon,
  Shield,
  Play,
  Plus,
  Sun,
  UserRound,
} from 'lucide-react'
import type { AppRoute } from '../app/routes'
import type { AuthUser } from '../services/auth'

type Theme = 'light' | 'dark'

type AppLayoutProps = {
  children: ReactNode
  activeRoute: AppRoute
  theme: Theme
  onNavigate: (route: AppRoute) => void
  onToggleTheme: () => void
  user: AuthUser
  onLogout: () => void
}

export function AppLayout({ children, activeRoute, theme, onNavigate, onToggleTheme, user, onLogout }: AppLayoutProps) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => onNavigate('home')}>
          <GraduationCap size={28} />
          <span>
            <strong>KT Prep</strong>
            <small>Trainer</small>
          </span>
        </button>
        <nav>
          <NavigationButton icon={<Home />} label="Главная" active={activeRoute === 'home'} onClick={() => onNavigate('home')} />
          <NavigationButton icon={<BookOpen />} label="Предметы" active={activeRoute === 'subjects'} onClick={() => onNavigate('subjects')} />
          <NavigationButton icon={<Plus />} label="Добавить" active={activeRoute === 'add'} onClick={() => onNavigate('add')} />
          <NavigationButton icon={<ListChecks />} label="Вопросы" active={activeRoute === 'manage'} onClick={() => onNavigate('manage')} />
          <NavigationButton icon={<Play />} label="Тест" active={activeRoute === 'quiz'} onClick={() => onNavigate('quiz')} />
          <NavigationButton icon={<Layers3 />} label="Реальный КТ" active={activeRoute === 'kt'} onClick={() => onNavigate('kt')} />
          <NavigationButton icon={<BarChart3 />} label="Статистика" active={activeRoute === 'stats'} onClick={() => onNavigate('stats')} />
          <NavigationButton icon={<UserRound />} label="Профиль" active={activeRoute === 'profile'} onClick={() => onNavigate('profile')} />
          {user.role === 'admin' && <NavigationButton icon={<Shield />} label="Админка" active={activeRoute === 'admin'} onClick={() => onNavigate('admin')} />}
        </nav>
        <button
          className="theme-toggle"
          type="button"
          role="switch"
          aria-checked={theme === 'dark'}
          aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          onClick={onToggleTheme}
        >
          <span className="theme-toggle-icon" aria-hidden="true">{theme === 'dark' ? <Moon /> : <Sun />}</span>
          <span className="theme-toggle-label">
            <strong>Тёмная тема</strong>
            <small>{theme === 'dark' ? 'Включена' : 'Выключена'}</small>
          </span>
          <span className="theme-toggle-track" aria-hidden="true"><span /></span>
        </button>
        <div className="profile-card">
          <span className="profile-avatar" aria-hidden="true">{user.login.slice(0, 1).toUpperCase()}</span>
          <div><strong>{user.login}</strong><small>Мой профиль</small></div>
          <button className="profile-logout" type="button" onClick={onLogout} aria-label="Выйти из аккаунта"><LogOut size={17} /></button>
        </div>
      </aside>
      <section className="workspace">{children}</section>
    </main>
  )
}

function NavigationButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`nav-button ${active ? 'active' : ''}`} type="button" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}
