/**
 * 间隔重复与日历聚合的单元测试。
 *
 * 重点覆盖两处最容易错的地方：
 *  1. 盒子在 0 与 5 两个边界上的进退；
 *  2. 日历 key 必须用**本地时区**，不能用 toISOString 截断。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BOX_INTERVALS,
  addDays,
  buildReviewQueue,
  countMastered,
  dayKey,
  isDue,
  monthGrid,
  reviewCountByDay,
  reviewEntry,
  scheduleNext,
  startOfDay,
} from '../src/lib/srs.ts'

function makeEntry(overrides = {}) {
  return {
    id: 'v_1',
    word: 'canopy',
    lemma: 'canopy',
    glossZh: '树冠层',
    glossSource: 'local',
    context: {
      articleId: 'art_1',
      articleTitle: 'Why Cities Are Planting More Trees',
      paragraphId: 'p_1',
      sentenceId: 'p_1#0',
      sentence: 'the trees were not distributed according to the wealth of a neighbourhood',
    },
    createdAt: '2026-11-17T10:00:00.000Z',
    box: 0,
    dueAt: '2026-11-17T00:00:00.000Z',
    reviews: [],
    ...overrides,
  }
}

test('scheduleNext：good 前进一盒，间隔按盒子取值', () => {
  const now = new Date('2026-11-17T12:00:00')
  const result = scheduleNext(makeEntry({ box: 1 }), 'good', now)

  assert.equal(result.box, 2)
  assert.equal(result.log.fromBox, 1)
  assert.equal(result.log.toBox, 2)
  assert.equal(new Date(result.dueAt).getTime(), addDays(now, BOX_INTERVALS[2]).getTime())
})

test('scheduleNext：easy 前进两盒，但不越过盒子 5', () => {
  const now = new Date('2026-11-17T12:00:00')
  assert.equal(scheduleNext(makeEntry({ box: 1 }), 'easy', now).box, 3)
  assert.equal(scheduleNext(makeEntry({ box: 4 }), 'easy', now).box, 5)
  assert.equal(scheduleNext(makeEntry({ box: 5 }), 'easy', now).box, 5)
})

test('scheduleNext：again 退回盒子 0 并在当天重现', () => {
  const now = new Date('2026-11-17T12:00:00')
  const result = scheduleNext(makeEntry({ box: 4 }), 'again', now)

  assert.equal(result.box, 0)
  assert.equal(result.dueAt, startOfDay(now).toISOString())
  assert.equal(isDue({ ...makeEntry(), box: 0, dueAt: result.dueAt }, now), true)
})

test('reviewEntry：追加一条复习历史且不修改原对象（纯函数）', () => {
  const entry = makeEntry({ box: 2 })
  const next = reviewEntry(entry, 'good', new Date('2026-11-17T12:00:00'))

  assert.equal(entry.reviews.length, 0)
  assert.equal(next.reviews.length, 1)
  assert.equal(next.reviews[0].grade, 'good')
  assert.notEqual(entry, next)
})

test('buildReviewQueue：只取已到期，按到期时间升序', () => {
  const now = new Date('2026-11-17T12:00:00')
  const entries = [
    makeEntry({ id: 'later', dueAt: '2026-12-01T00:00:00.000Z' }),
    makeEntry({ id: 'soon', dueAt: '2026-11-10T00:00:00.000Z' }),
    makeEntry({ id: 'today', dueAt: '2026-11-17T00:00:00.000Z' }),
  ]

  assert.deepEqual(
    buildReviewQueue(entries, now).map((e) => e.id),
    ['soon', 'today'],
  )
})

test('countMastered：只统计盒子 5', () => {
  const entries = [makeEntry({ box: 0 }), makeEntry({ box: 5 }), makeEntry({ box: 5 })]
  assert.equal(countMastered(entries), 2)
})

test('dayKey：用本地时区，凌晨不会被算到前一天', () => {
  // 本地时间 2026-11-17 00:30 —— toISOString 在东八区会返回 11-16，这是经典 bug
  const localEarly = new Date(2026, 10, 17, 0, 30, 0)
  assert.equal(dayKey(localEarly), '2026-11-17')
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59, 0)), '2026-01-05')
})

test('reviewCountByDay：按本地日期聚合复习次数', () => {
  const entries = [
    makeEntry({
      id: 'a',
      reviews: [
        { at: new Date(2026, 10, 17, 9, 0).toISOString(), grade: 'good', fromBox: 0, toBox: 1 },
        { at: new Date(2026, 10, 17, 21, 0).toISOString(), grade: 'good', fromBox: 1, toBox: 2 },
      ],
    }),
    makeEntry({
      id: 'b',
      reviews: [
        { at: new Date(2026, 10, 18, 10, 0).toISOString(), grade: 'again', fromBox: 2, toBox: 0 },
      ],
    }),
  ]

  const map = reviewCountByDay(entries)
  assert.equal(map.get('2026-11-17'), 2)
  assert.equal(map.get('2026-11-18'), 1)
})

test('monthGrid：固定 42 格，首格是当月 1 日所在周的周日', () => {
  const grid = monthGrid(2026, 10) // 2026 年 11 月（月份从 0 开始）
  assert.equal(grid.length, 42)
  assert.equal(grid[0].getDay(), 0)
  assert.ok(grid.some((d) => d.getDate() === 1 && d.getMonth() === 10))
})
