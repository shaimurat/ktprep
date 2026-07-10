import type { ReactNode } from 'react'
import {
  BarChart3,
  BookOpen,
  GraduationCap,
  Home,
  Layers3,
  ListChecks,
  Moon,
  Play,
  Plus,
  Sun,
} from 'lucide-react'
import type { AppRoute } from '../app/routes'

type Theme = 'light' | 'dark'

type AppLayoutProps = {
  children: ReactNode
  activeRoute: AppRoute
  theme: Theme
  onNavigate: (route: AppRoute) => void
  onToggleTheme: () => void
}

export function AppLayout({ children, activeRoute, theme, onNavigate, onToggleTheme }: AppLayoutProps) {
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
