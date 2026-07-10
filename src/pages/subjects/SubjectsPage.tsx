import type { AppRoute } from '../../app/routes'
import { PageTitle } from '../../components/PageTitle'
import { SubjectGrid } from '../../components/SubjectGrid'
import type { Subject } from '../../types'

export function SubjectsPage({ counts, onNavigate }: { counts: Record<Subject, number>; onNavigate: (route: AppRoute, subject?: Subject) => void }) {
  return (
    <>
      <PageTitle title="Предметы" text="Отдельные страницы-карточки для каждого блока подготовки." />
      <SubjectGrid counts={counts} onNavigate={onNavigate} />
    </>
  )
}
