/**
 * 长句解析（离线规则层）的单元测试。
 *
 * 用的都是内置示例文章里的真实长句 —— 解析器最容易在真实语料上翻车，
 * 自己编的短句测不出问题。
 *
 * 验收原则（与 docs/TEAM.md 一致）：
 *   · 主干必须**不等于**整句（否则等于没解析）；
 *   · 成分区间必须能精确切回原文；
 *   · 解析不出来时宁可不切，不许编。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeSentence } from '../src/lib/clause.ts'

const DEMO_1 =
  'The companies that understand this best have therefore stopped trying to expand the total pool of attention and started competing instead on the quality of the minutes they obtain, which is a far more difficult thing to measure and an even more difficult thing to defend.'

const DEMO_2 =
  'When city planners in Melbourne began mapping the urban canopy a decade ago, they discovered something that surprised them: the trees were not distributed according to the wealth of a neighbourhood, but according to the age of its streets.'

const DEMO_3 =
  'Economists have a word for this, and it is not a comfortable one: they call it a zero-sum game, meaning that any gain on one side of the ledger is necessarily matched by an equivalent loss on the other.'

/** 每个成分的 start/end 必须能精确切回它自己的 text */
function assertSegmentsConsistent(result) {
  for (const segment of result.segments) {
    assert.equal(
      result.text.slice(segment.start, segment.end),
      segment.text,
      `成分区间与文本不一致：${segment.text}`,
    )
    assert.ok(segment.start >= 0 && segment.end <= result.text.length, '成分区间越界')
    assert.ok(segment.noteZh.length > 0, '成分缺少中文讲解')
  }
  // 成分之间不许重叠，否则高亮会叠在一起
  const sorted = [...result.segments].sort((a, b) => a.start - b.start)
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(sorted[i].start >= sorted[i - 1].end, '成分区间重叠')
  }
}

test('定语从句：that understand this best 被单独切出', () => {
  const result = analyzeSentence(DEMO_1, { sentenceId: 's_1' })
  assertSegmentsConsistent(result)
  assert.equal(result.sentenceId, 's_1')
  assert.equal(result.source, 'rule')

  const relative = result.segments.find((s) => s.text.startsWith('that understand'))
  assert.ok(relative, '未切出 that 引导的定语从句')
  assert.equal(relative.role, 'attributive-clause')
  assert.equal(relative.text, 'that understand this best')
})

test('非限制性定语从句：which 从句被识别且主干不含它', () => {
  const result = analyzeSentence(DEMO_1)
  const nonRestrictive = result.segments.find((s) => s.text.startsWith('which is'))
  assert.ok(nonRestrictive, '未切出 which 引导的从句')
  assert.match(nonRestrictive.noteZh, /非限制性/)

  assert.notEqual(result.backbone, result.text.trim(), '主干不应等于整句')
  assert.ok(!result.backbone.includes('which is a far more'), '主干里不应残留 which 从句')
  assert.ok(result.backbone.startsWith('The companies'), '主干应以主语开头')
  assert.ok(result.backbone.includes('have therefore stopped'), '主干应保留谓语')
})

test('状语从句 + 定语从句：When 从句与 that surprised 都被切出', () => {
  const result = analyzeSentence(DEMO_2)
  assertSegmentsConsistent(result)

  const adverbial = result.segments.find((s) => s.text.startsWith('When city planners'))
  assert.ok(adverbial, '未切出 When 引导的状语从句')
  assert.equal(adverbial.role, 'adverbial-clause')

  const relative = result.segments.find((s) => s.text.startsWith('that surprised'))
  assert.ok(relative, '未切出 that surprised them')
  assert.equal(relative.role, 'attributive-clause')

  assert.ok(result.backbone.includes('they discovered something'), '主干应保留外层主句')
})

test('宾语/同位语：that 前面的动词与抽象名词能影响判定', () => {
  const warned = analyzeSentence('The report warns that any gain on one side is matched by a loss.')
  const objectClause = warned.segments.find((s) => s.role === 'object-clause')
  assert.ok(objectClause, 'warns that … 应判为宾语从句')

  const idea = analyzeSentence('The idea that cities can be planned is not new.')
  const appositive = idea.segments.find((s) => s.role === 'appositive')
  assert.ok(appositive, 'the idea that … 应判为同位语从句')
})

test('从句嵌套在逗号分句里时，主干仍然可读', () => {
  const result = analyzeSentence(DEMO_3)
  assertSegmentsConsistent(result)
  assert.ok(result.segments.length >= 1, '至少应切出一个成分')
  assert.ok(result.backbone.length > 0, '主干不应为空')
  assert.ok(result.backbone.length < result.text.length, '主干应短于整句')
})

test('解析不出来时保持诚实：不切成分、提示是简单句', () => {
  const result = analyzeSentence('It is easy to despise what you cannot get.')
  assert.ok(result.tips.length > 0)
  assert.ok(
    result.tips.some((t) => t.includes('简单句') || t.includes('未能')),
    '无法解析时应给出提示',
  )
})

test('短句直接返回整句为主干，不做无意义切分', () => {
  const result = analyzeSentence('Hi there.')
  assert.equal(result.segments.length, 0)
  assert.equal(result.backbone, 'Hi there.')
})

test('深度：有成分时 depth 上升，无成分时为 0', () => {
  assert.equal(analyzeSentence('Hi there.').depth, 0)
  assert.ok(analyzeSentence(DEMO_2).depth >= 1)
  assert.ok(analyzeSentence(DEMO_1).depth >= 2)
})
