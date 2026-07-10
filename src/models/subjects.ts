import type { Subject, SubjectInfo } from '../types'

export const SUBJECTS: SubjectInfo[] = [
  {
    id: 'tgo',
    title: 'ТГО',
    shortTitle: 'ТГО',
    description: 'Теоретическая грамотность, логика и базовые понятия.',
    color: '#2563eb',
  },
  {
    id: 'english',
    title: 'Английский язык',
    shortTitle: 'English',
    description: 'Грамматика, лексика и понимание смысла предложений.',
    color: '#059669',
  },
  {
    id: 'databases',
    title: 'Базы данных',
    shortTitle: 'DB',
    description: 'SQL, ключи, связи, нормализация и модели данных.',
    color: '#7c3aed',
  },
  {
    id: 'algorithms',
    title: 'Алгоритмы и структуры данных',
    shortTitle: 'Algo',
    description: 'Сложность, массивы, графы, сортировки и структуры.',
    color: '#dc2626',
  },
]

export const SUBJECT_IDS = SUBJECTS.map((subject) => subject.id)

export const subjectById = (id: Subject) =>
  SUBJECTS.find((subject) => subject.id === id) ?? SUBJECTS[0]

export const emptyBySubject = () =>
  SUBJECT_IDS.reduce(
    (acc, subject) => {
      acc[subject] = { total: 0, correct: 0 }
      return acc
    },
    {} as Record<Subject, { total: number; correct: number }>,
  )
