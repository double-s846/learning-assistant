/**
 * 切段 / 切句 / 切词 / 词形还原的单元测试。
 *
 * 为什么优先测这些：它们是「点词位置」「逐句高亮」「长句标注」共用的地基，
 * 而且边界条件（缩写、小数、引号、所有格）最容易写错，出错后现象是"高亮错位"，
 * 很难在界面上一眼看出原因。
 *
 * 运行：npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  countWords,
  estimateReadingMinutes,
  guessLemma,
  lemmaCandidates,
  normalizeWord,
  splitParagraphs,
  splitSentences,
  tokenizeWords,
} from '../src/lib/tokenize.ts'

const texts = (input) => splitSentences(input).map((s) => s.text)

test('切句：常见缩写不触发断句', () => {
  assert.deepEqual(texts('Mr. Smith went home. He was tired.'), [
    'Mr. Smith went home.',
    'He was tired.',
  ])
  assert.deepEqual(texts('Use tools, e.g. a knife, carefully. Then stop.'), [
    'Use tools, e.g. a knife, carefully.',
    'Then stop.',
  ])
  assert.deepEqual(texts('Dr. Wang met Prof. Li at 9 a.m. yesterday.'), [
    'Dr. Wang met Prof. Li at 9 a.m. yesterday.',
  ])
})

test('切句：小数不是句子边界', () => {
  assert.deepEqual(texts('Pi is about 3.14 today. Nice.'), ['Pi is about 3.14 today.', 'Nice.'])
})

test('切句：引号收尾只切一次', () => {
  assert.deepEqual(texts('He said "Go away." She left.'), ['He said "Go away."', 'She left.'])
})

test('切句：无结尾标点也成句 / 空串返回空数组', () => {
  assert.deepEqual(texts('This has no period'), ['This has no period'])
  assert.deepEqual(splitSentences(''), [])
})

test('切句：区间能精确还原原文（高亮不错位的前提）', () => {
  const text = 'Mr. Smith went home. He was tired.'
  for (const span of splitSentences(text)) {
    assert.equal(text.slice(span.start, span.end), span.text)
  }
})

test('切段：空行分段，单换行合并为空格', () => {
  assert.deepEqual(splitParagraphs('A one.\n\nB two.\n\n\nC three.'), ['A one.', 'B two.', 'C three.'])
  assert.deepEqual(splitParagraphs('line one\nline two'), ['line one line two'])
  assert.deepEqual(splitParagraphs('  \n\n  '), [])
})

test('切词：保留标点与空格，去掉所有格撇号', () => {
  assert.deepEqual(
    tokenizeWords('Hello, world!').map((w) => w.text),
    ['Hello', ', ', 'world', '!'],
  )
  assert.deepEqual(
    tokenizeWords("readers' choice")
      .filter((w) => w.isWord)
      .map((w) => w.text),
    ['readers', 'choice'],
  )
})

test('切词：词数统计与阅读时长', () => {
  assert.equal(countWords('one two three'), 3)
  assert.equal(estimateReadingMinutes('word '.repeat(400)), 2)
  assert.equal(estimateReadingMinutes('hi'), 1) // 最少 1 分钟
})

test('词形还原：候选链按「先直接去尾，再回填 e」排序', () => {
  assert.deepEqual(lemmaCandidates('deteriorating'), ['deteriorat', 'deteriorate'])
  assert.deepEqual(lemmaCandidates('making'), ['mak', 'make'])
  assert.deepEqual(lemmaCandidates('cities'), ['city'])
  assert.deepEqual(lemmaCandidates('studies'), ['study'])
  assert.deepEqual(lemmaCandidates('boxes'), ['box'])
  assert.deepEqual(lemmaCandidates('running'), ['runn', 'runne', 'run'])
  assert.deepEqual(lemmaCandidates('the'), [])
})

test('词形还原：guessLemma 取首选候选，短词原样返回', () => {
  assert.equal(guessLemma('deteriorating'), 'deteriorat')
  assert.equal(guessLemma('Cities'), 'city')
  assert.equal(guessLemma('the'), 'the')
})

test('词形还原：不把正常以 er / est 结尾的单词误判为比较级', () => {
  for (const word of ['Consider', 'water', 'number', 'interest', 'forest']) {
    assert.deepEqual(lemmaCandidates(word), [])
    assert.equal(guessLemma(word), word.toLowerCase())
  }
})

test('归一化：小写并去掉首尾非字母字符', () => {
  assert.equal(normalizeWord('"Deteriorating,"'), 'deteriorating')
  assert.equal(normalizeWord('—word—'), 'word')
})
