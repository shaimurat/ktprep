import type { AnswerKey, Question, TestResult } from '../types'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

const request = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}/api/${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>)
}

export const loadQuestions = async () => {
  const stored = await request<Question[]>('questions')
  return stored.map((question) => ({
    ...question,
    topic: question.topic?.trim() || 'Без темы',
  }))
}

export const saveQuestions = (questions: Question[]) =>
  request<void>('questions', { method: 'PUT', body: JSON.stringify(questions) })

export const loadResults = () => request<TestResult[]>('results')

export type QuizReview = Record<string, { correct: boolean; correctAnswers: AnswerKey[]; explanation: string | null }>

export const submitResult = (payload: { mode: TestResult['mode']; questionIds: string[]; answers: Record<string, AnswerKey[] | undefined> }) =>
  request<{ result: TestResult; review: QuizReview; attemptsRemaining: number }>('results', { method: 'POST', body: JSON.stringify(payload) })
