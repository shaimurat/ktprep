import assert from 'node:assert/strict'
import test from 'node:test'
import { scoreAnswers } from '../src/utils/answers.js'

test('scores partial and exact multi-answer choices', () => {
  assert.equal(scoreAnswers(['A', 'B'], ['A', 'B']).points, 2)
  assert.equal(scoreAnswers(['A'], ['A', 'B']).points, 1)
  assert.equal(scoreAnswers(['A', 'C'], ['A', 'B']).points, 0)
  assert.equal(scoreAnswers(['A', 'B', 'C'], ['A', 'B']).points, 1)
  assert.equal(scoreAnswers(['A'], ['A']).points, 1)
})
