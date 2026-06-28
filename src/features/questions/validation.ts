import { SUBJECT_IDS } from '../../shared/subjects'
import { ANSWER_KEYS } from '../../shared/answers'
import type { AnswerKey, Question, Subject } from '../../types'
import { createId } from '../../utils/id'

type RawQuestion = Partial<Omit<Question, 'id'>> & {
  id?: string
  correctAnswer?: AnswerKey | AnswerKey[]
  correctAnswers?: AnswerKey[]
}

export const jsonExample = `[
  {
    "subject": "databases",
    "topic": "Ключи и связи",
    "question": "Что такое первичный ключ?",
    "options": {
      "A": "Поле, которое уникально идентифицирует запись",
      "B": "Поле для хранения только чисел",
      "C": "Любой внешний атрибут",
      "D": "Команда SQL",
      "E": "Индекс без ограничений уникальности",
      "F": "Временная таблица",
      "G": "Представление",
      "H": "Ограничение уникальности",
      "I": "Триггер"
    },
    "correctAnswers": ["A", "H"],
    "explanation": "Первичный ключ уникально идентифицирует каждую запись, а ограничение уникальности помогает не допускать повторов."
  }
]`

const isSubject = (value: unknown): value is Subject =>
  typeof value === 'string' && SUBJECT_IDS.includes(value as Subject)

const isAnswer = (value: unknown): value is AnswerKey =>
  typeof value === 'string' && ANSWER_KEYS.includes(value as AnswerKey)

const normalizeCorrectAnswers = (item: RawQuestion) => {
  const raw = item.correctAnswers ?? item.correctAnswer
  const answers = Array.isArray(raw) ? raw : raw ? [raw] : []

  if (answers.some((answer) => !isAnswer(answer))) {
    return { answers: [], error: 'correctAnswers должен содержать только буквы от A до I.' }
  }

  return {
    answers: answers.filter((answer, index) => answers.indexOf(answer) === index),
    error: '',
  }
}

export const normalizeQuestion = (
  item: RawQuestion,
  index = 0,
): { question?: Question; error?: string } => {
  const label = `Вопрос ${index + 1}:`

  if (!isSubject(item.subject)) {
    return { error: `${label} неизвестный subject. Используйте tgo, english, databases или algorithms.` }
  }

  if (!item.question || typeof item.question !== 'string') {
    return { error: `${label} отсутствует question.` }
  }

  if (item.topic !== undefined && typeof item.topic !== 'string') {
    return { error: `${label} topic должен быть строкой.` }
  }

  if (!item.options || typeof item.options !== 'object') {
    return { error: `${label} отсутствуют options.` }
  }

  const options: Question['options'] = {}
  const rawOptions = item.options as Record<string, unknown>

  for (const [key, value] of Object.entries(rawOptions)) {
    if (!isAnswer(key)) {
      return { error: `${label} options поддерживает только варианты от A до I.` }
    }

    if (typeof value !== 'string') {
      return { error: `${label} option ${key} должен быть строкой.` }
    }

    if (value.trim()) {
      options[key] = value.trim()
    }
  }

  if (Object.keys(options).length < 2) {
    return { error: `${label} options должен содержать минимум два непустых варианта от A до I.` }
  }

  const correctResult = normalizeCorrectAnswers(item)
  const correctAnswers = correctResult.answers

  if (correctResult.error) {
    return { error: `${label} ${correctResult.error}` }
  }

  if (!correctAnswers.length) {
    return { error: `${label} отсутствует correctAnswers или correctAnswer.` }
  }

  for (const answer of correctAnswers) {
    if (!options[answer]) {
      return { error: `${label} правильный ответ ${answer} отсутствует среди options.` }
    }
  }

  return {
    question: {
      id: item.id || createId(),
      subject: item.subject,
      topic: item.topic?.trim() || 'Без темы',
      question: item.question.trim(),
      options,
      correctAnswers,
      explanation: item.explanation?.trim(),
    },
  }
}

export const parseQuestionsJson = (value: string) => {
  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    return { questions: [], error: 'Неверный формат JSON. Проверьте скобки, кавычки и запятые.' }
  }

  if (!Array.isArray(parsed)) {
    return { questions: [], error: 'JSON должен быть массивом вопросов: [ { ... } ].' }
  }

  const questions: Question[] = []

  for (let index = 0; index < parsed.length; index += 1) {
    const item = parsed[index]
    if (!item || typeof item !== 'object') {
      return { questions: [], error: `Вопрос ${index + 1}: должен быть объектом.` }
    }

    const result = normalizeQuestion(item as RawQuestion, index)
    if (result.error || !result.question) {
      return { questions: [], error: result.error }
    }
    questions.push(result.question)
  }

  return { questions, error: '' }
}
