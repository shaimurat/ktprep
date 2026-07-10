import type { AnswerKey, Question } from '../types'

export const ANSWER_KEYS: AnswerKey[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']

export const getCorrectAnswers = (question: Question): AnswerKey[] => {
  if (Array.isArray(question.correctAnswers) && question.correctAnswers.length) {
    return question.correctAnswers
  }

  if (Array.isArray(question.correctAnswer)) {
    return question.correctAnswer
  }

  return question.correctAnswer ? [question.correctAnswer] : []
}

export const getQuestionOptions = (question: Question) =>
  ANSWER_KEYS.filter((answer) => question.options[answer]?.trim())

export const formatAnswers = (answers: AnswerKey[] | undefined) =>
  answers?.length ? [...answers].sort().join(', ') : 'не выбран'

export const answersMatch = (selected: AnswerKey[] | undefined, correct: AnswerKey[]) => {
  if (!selected || selected.length !== correct.length) return false

  const selectedSet = new Set(selected)
  return correct.every((answer) => selectedSet.has(answer))
}
