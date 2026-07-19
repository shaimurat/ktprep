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

export const scoreAnswers = (selected: AnswerKey[] | undefined, correct: AnswerKey[]) => {
  const selectedSet = new Set(selected)
  const correctSet = new Set(correct)
  const correctCount = correct.filter((answer) => selectedSet.has(answer)).length
  const incorrectCount = [...selectedSet].filter((answer) => !correctSet.has(answer)).length
  const maxPoints = correct.length > 1 ? 2 : 1
  const exact = correct.length > 0 && correctCount === correct.length && incorrectCount === 0

  return {
    correctCount,
    incorrectCount,
    missedCount: correct.length - correctCount,
    maxPoints,
    points: exact ? maxPoints : correctCount > incorrectCount ? 1 : 0,
    exact,
  }
}

export const answersMatch = (selected: AnswerKey[] | undefined, correct: AnswerKey[]) =>
  scoreAnswers(selected, correct).exact
