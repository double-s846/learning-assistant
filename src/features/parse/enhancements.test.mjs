import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeSentence } from '../../lib/clause.ts'
import { getSentenceParse } from './cache.ts'

test('contact clause preserves outer predicate and exact offsets', () => {
  const text = 'The minutes they obtain are valuable.'
  const p = analyzeSentence(text)
  assert.equal(p.segments[0].text, 'they obtain')
  assert.equal(p.backbone, 'The minutes are valuable.')
  assert.equal(text.slice(p.segments[0].start, p.segments[0].end), 'they obtain')
})
test('pronouns after punctuation and reporting verbs are not contact clauses', () => {
  for (const text of ['I think they obtain more.', 'The minutes, they obtain more.', 'They read books.']) {
    assert.equal(analyzeSentence(text).segments.length, 0)
  }
})
test('coordinated relatives exclude conjunction from backbone', () => {
  const p = analyzeSentence('The tool, which is cheap and which is useful, helps us.')
  assert.deepEqual(p.segments.map(s => s.text), ['which is cheap', 'which is useful'])
  assert.equal(p.backbone, 'The tool helps us.')
  assert.ok(p.segments[0].end <= p.segments[1].start)
})
test('ordinary main clause coordination is retained', () => {
  const p = analyzeSentence('The tool, which is cheap, works and saves time.')
  assert.equal(p.backbone, 'The tool works and saves time.')
})
test('cached parses isolate ids, mutations and revised text', () => {
  const text = 'The minutes they obtain are valuable.'
  const a = getSentenceParse(text, 'a')
  a.segments[0].text = 'corrupted'
  const b = getSentenceParse(text, 'b')
  assert.equal(b.sentenceId, 'b')
  assert.equal(b.segments[0].text, 'they obtain')
  assert.equal(getSentenceParse('Hi there.', 'b').segments.length, 0)
})
