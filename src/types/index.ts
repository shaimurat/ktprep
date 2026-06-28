export type Subject = 'tgo' | 'english' | 'databases' | 'algorithms'

export type AnswerKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'

export type Question = {
  id: string
  subject: Subject
  topic: string
  question: string
  options: Partial<Record<AnswerKey, string>>
  correctAnswers: AnswerKey[]
  correctAnswer?: AnswerKey | AnswerKey[]
  explanation?: string
}

export type TestResult = {
  id: string
  mode: 'subject' | 'random' | 'kt'
  date: string
  totalQuestions: number
  correctAnswers: number
  percentage: number
  bySubject: Record<
    Subject,
    {
      total: number
      correct: number
    }
  >
}

export type SubjectInfo = {
  id: Subject
  title: string
  shortTitle: string
  description: string
  color: string
}
