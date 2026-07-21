export type Subject = 'tgo' | 'english' | 'databases' | 'algorithms'

export type AnswerKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'

export type QuestionTable = { headers: string[]; rows: string[][] }

export type Question = {
  id: string
  subject: Subject
  author?: string
  topic: string
  question: string
  options: Partial<Record<AnswerKey, string>>
  correctAnswers: AnswerKey[]
  correctAnswer?: AnswerKey | AnswerKey[]
  explanation?: string
  table?: QuestionTable
}

export type TestResult = {
  id: string
  mode: 'subject' | 'random' | 'kt' | 'kt-hard'
  date: string
  totalQuestions: number
  correctAnswers: number
  score?: number
  maxScore?: number
  percentage: number
  bySubject: Record<
    Subject,
    {
      total: number
      correct: number
    }
  >
  questionAttempts?: QuestionAttempt[]
}

export type QuestionAttempt = {
  questionId: string
  subject: Subject
  topic: string
  correct: boolean
}

export type SubjectInfo = {
  id: Subject
  title: string
  shortTitle: string
  description: string
  color: string
}
