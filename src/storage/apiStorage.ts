import { demoQuestions } from '../shared/demoQuestions'
import type { Question, TestResult } from '../types'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

const request = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}/api/${path}`, {
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
  const questions = stored.length ? stored : demoQuestions
  const normalized = questions.map((question) => ({
    ...question,
    topic: question.topic?.trim() || 'Без темы',
  }))
  if (!stored.length) await saveQuestions(normalized)
  return normalized
}

export const saveQuestions = (questions: Question[]) =>
  request<void>('questions', { method: 'PUT', body: JSON.stringify(questions) })

export const loadResults = () => request<TestResult[]>('results')

export const saveResults = (results: TestResult[]) =>
  request<void>('results', { method: 'PUT', body: JSON.stringify(results) })
