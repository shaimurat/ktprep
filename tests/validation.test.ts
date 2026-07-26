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

test('imports tree and graph diagrams', () => {
  const result = parseQuestionsJson('[{"subject":"algorithms","question":"Q","diagram":{"type":"tree","root":{"value":"+","left":{"value":"1"},"right":{"value":"2"}}},"options":{"A":"Yes","B":"No"},"correctAnswers":["A"]},{"subject":"algorithms","question":"Q","diagram":{"type":"graph","nodes":[{"id":"A"},{"id":"B"}],"edges":[{"from":"A","to":"B","label":"5"}]},"options":{"A":"Yes","B":"No"},"correctAnswers":["A"]}]')
  assert.equal(result.error, '')
  assert.equal(result.questions[0]?.diagram?.type, 'tree')
  assert.deepEqual(result.questions[1]?.diagram, { type: 'graph', nodes: [{ id: 'A', label: undefined }, { id: 'B', label: undefined }], edges: [{ from: 'A', to: 'B', label: '5' }], directed: undefined })
})

test('rejects graph edges that point to missing vertices', () => {
  const result = parseQuestionsJson('[{"subject":"algorithms","question":"Q","diagram":{"type":"graph","nodes":[{"id":"A"}],"edges":[{"from":"A","to":"B"}]},"options":{"A":"Yes","B":"No"},"correctAnswers":["A"]}]')
  assert.match(result.error ?? '', /существующие вершины/)
})
