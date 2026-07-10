import type { CSSProperties } from 'react'
import { Database, ListChecks, Play, Plus } from 'lucide-react'
import type { AppRoute } from '../app/routes'
import { SUBJECTS } from '../models/subjects'
import type { Subject } from '../types'

type SubjectGridProps = {
  counts: Record<Subject, number>
  onNavigate: (route: AppRoute, subject?: Subject) => void
}

export function SubjectGrid({ counts, onNavigate }: SubjectGridProps) {
  return (
    <div className="subject-grid">
      {SUBJECTS.map((subject) => (
        <article className="card subject-card" key={subject.id} style={{ '--subject-color': subject.color } as CSSProperties}>
          <div className="subject-icon"><Database size={20} /></div>
          <h3>{subject.title}</h3>
          <p>{subject.description}</p>
          <strong>{counts[subject.id]} вопросов</strong>
          <div className="card-actions">
            <button className="primary-button" type="button" onClick={() => onNavigate('quiz', subject.id)}><Play size={16} /> Пройти тест</button>
            <button className="secondary-button" type="button" onClick={() => onNavigate('add', subject.id)}><Plus size={16} /> Добавить</button>
            <button className="ghost-button" type="button" onClick={() => onNavigate('manage', subject.id)}><ListChecks size={16} /> Вопросы</button>
          </div>
        </article>
      ))}
    </div>
  )
}
