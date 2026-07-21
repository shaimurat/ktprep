import assert from 'node:assert/strict'
import test from 'node:test'
import { parseQuestionsJson } from '../src/pages/questions/utils/validation.js'

test('imports a table with matching headers and cells', () => {
  const result = parseQuestionsJson('[{"subject":"databases","question":"Q","table":{"headers":["A","B"],"rows":[["1","2"]]},"options":{"A":"Yes","B":"No"},"correctAnswers":["A"]}]')
  assert.deepEqual(result.questions[0]?.table, { headers: ['A', 'B'], rows: [['1', '2']] })
  assert.equal(result.error, '')
})

test('rejects a table with uneven rows', () => {
  const result = parseQuestionsJson('[{"subject":"databases","question":"Q","table":{"headers":["A","B"],"rows":[["1"]]},"options":{"A":"Yes","B":"No"},"correctAnswers":["A"]}]')
  assert.match(result.error ?? '', /table\.rows/)
})
