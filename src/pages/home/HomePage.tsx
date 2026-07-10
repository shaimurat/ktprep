import { BarChart3, Layers3, Plus } from 'lucide-react'
import type { AppRoute } from '../../app/routes'
import { SubjectGrid } from '../../components/SubjectGrid'
import type { Subject } from '../../types'

type HomePageProps = {
  counts: Record<Subject, number>
  totalQuestions: number
  totalResults: number
  onNavigate: (route: AppRoute, subject?: Subject) => void
}

export function HomePage({ counts, totalQuestions, totalResults, onNavigate }: HomePageProps) {
  return (
    <>
      <header className="hero-panel">
        <div>
          <span className="eyebrow">Учебный тренажер</span>
          <h1>KT Prep Trainer</h1>
          <p>Готовься к КТ по четырем предметам: добавляй собственные вопросы, проходи короткие тесты и запускай режим полного экзамена.</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => onNavigate('kt')}><Layers3 size={18} /> Пройти реальный КТ</button>
            <button className="secondary-button" type="button" onClick={() => onNavigate('add')}><Plus size={18} /> Добавить вопросы</button>
          </div>
        </div>
        <div className="hero-meter" aria-label="Сводка">
          <div><strong>{totalQuestions}</strong><span>вопросов</span></div>
          <div><strong>{totalResults}</strong><span>попыток</span></div>
        </div>
      </header>
      <section className="section-header">
        <div><h2>Предметы</h2><p>Выбери направление и начни тренировку.</p></div>
        <button className="ghost-button" type="button" onClick={() => onNavigate('stats')}><BarChart3 size={18} /> Статистика</button>
      </section>
      <SubjectGrid counts={counts} onNavigate={onNavigate} />
    </>
  )
}
