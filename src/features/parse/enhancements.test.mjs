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

import { enhanceParse } from './llm.ts'
const sentence = 'The minutes they obtain are valuable.'
const config = { baseUrl: 'https://example.test/v1', model: 'test' }
test('unconfigured enhancement makes no requests', async () => {
  const result = await enhanceParse(sentence, 's', {}, undefined, () => { throw Error('must not request') })
  assert.equal(result.source, 'rule')
})
test('enhancement preserves original structure and adds explanation', async () => {
  const result = await enhanceParse(sentence, 's', config, undefined, async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ translationZh: '他们获得的时间很宝贵。', notes: ['省略关系词的定语从句'] }) } }] })))
  assert.equal(result.source, 'llm')
  assert.deepEqual(result.segments.map(s => [s.start, s.end, s.text]), analyzeSentence(sentence).segments.map(s => [s.start, s.end, s.text]))
})
test('failed, malformed and mismatched responses silently fall back', async () => {
  for (const request of [async () => { throw Error('offline') }, async () => new Response('', { status: 500 }), async () => new Response('{}'), async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"translationZh":"x","notes":[]}' } }] }))]) {
    assert.equal((await enhanceParse(sentence, 's', { ...config, model: 'failure' }, undefined, request)).source, 'rule')
  }
})
test('aborted requests do not return enhanced results', async () => {
  const controller = new AbortController()
  controller.abort()
  assert.equal((await enhanceParse(sentence, 's', config, controller.signal)).source, 'rule')
})

test('short contact clause ends at comma and auxiliary belongs to its subject', () => {
  assert.equal(analyzeSentence('The minutes they obtain, which are valuable, matter.').segments[0].text, 'they obtain')
  assert.equal(analyzeSentence('The book she has read is useful.').segments[0].text, 'she has read')
  assert.equal(analyzeSentence('The book that she has read is useful.').segments[0].text, 'that she has read')
})
test('enhancement cache reuses success without sharing mutable objects', async () => {
  let requests = 0
  const request = async () => {
    requests++
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ translationZh: '参考译文', notes: ['参考讲解'] }) } }] }))
  }
  const cfg = { ...config, model: 'cache-test' }
  const a = await enhanceParse(sentence, 'first', cfg, undefined, request)
  a.segments[0].noteZh = 'changed'
  const b = await enhanceParse(sentence, 'second', cfg, undefined, request)
  assert.equal(requests, 1)
  assert.equal(b.sentenceId, 'second')
  assert.equal(b.segments[0].noteZh, '参考讲解')
})

test('in-flight cancellation falls back and does not poison cache', async () => {
  const controller = new AbortController()
  const pending = enhanceParse(sentence, 'cancel', { ...config, model: 'cancel-active' }, controller.signal,
    async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }))
  controller.abort()
  assert.equal((await pending).source, 'rule')
})
test('eight second timeout falls back without a user-facing error', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const pending = enhanceParse(sentence, 'timeout', { ...config, model: 'timeout' }, undefined,
    async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true })
    }))
  t.mock.timers.tick(8000)
  assert.equal((await pending).source, 'rule')
})
test('unrecognized sentences never trigger invented model structure', async () => {
  let called = false
  const result = await enhanceParse('Hi there.', 'short', config, undefined, async () => { called = true; throw Error() })
  assert.equal(called, false)
  assert.equal(result.segments.length, 0)
})
