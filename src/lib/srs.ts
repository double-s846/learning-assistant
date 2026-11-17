/** AI-assisted: 初稿由 DeepSeek（2026-11-17）生成，人工修改点见 docs/AI_USAGE.md 第 3 节。 */
/**
 * ============================================================================
 *  间隔重复（SRS）与日历统计
 * ============================================================================
 *
 *  采用最经典的 Leitner 盒子模型：6 个盒子，盒子越靠后间隔越长。
 *  选择它而不是 SM-2，是因为规则简单、可解释、演示时评委 10 秒能看懂，
 *  而且不需要依赖用户的"难度自评"数值。
 *
 *  盒子 → 间隔：0 天(今天) → 1 天 → 2 天 → 4 天 → 8 天 → 16 天
 *    · 选 "again"（没记住）→ 退回盒子 0，立刻重现
 *    · 选 "good"            → 前进一个盒子
 *    · 选 "easy"            → 前进两个盒子
 *  到了盒子 5 且选 good/easy 即视为「已掌握」，不再进入每日队列。
 *
 *  ⚠️ 组员：日历视图 / 复习队列都请调用本文件的函数，
 *     不要各自实现一套日期比较（时区处理必须只有一处）。
 * ============================================================================
 */

import type { ReviewBox, ReviewGrade, ReviewLog, VocabEntry } from '@/types'

/** 各盒子对应的下次复习间隔（天）。索引即盒子编号 */
export const BOX_INTERVALS: readonly number[] = [0, 1, 2, 4, 8, 16]

export const MASTERED_BOX: ReviewBox = 5

export const GRADE_LABEL: Record<ReviewGrade, string> = {
  again: '没记住',
  good: '记得',
  easy: '很简单',
}

/* ---------------------------------------------------------------- 日期 */

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** 以**本地时区**生成 YYYY-MM-DD，作为日历格子的 key（不要用 toISOString，会跨天） */
export function dayKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* ------------------------------------------------------------ 复习计算 */

export interface NextReview {
  box: ReviewBox
  dueAt: string
  log: ReviewLog
}

/**
 * 根据一次复习结果算出新的盒子与到期时间。
 * @param entry 复习前生词卡
 * @param grade 用户评分
 * @param now   注入时间便于测试与「时间旅行」演示
 */
export function scheduleNext(entry: VocabEntry, grade: ReviewGrade, now: Date = new Date()): NextReview {
  const fromBox = entry.box
  let toBox: number

  if (grade === 'again') {
    toBox = 0
  } else if (grade === 'easy') {
    toBox = fromBox + 2
  } else {
    toBox = fromBox + 1
  }

  const box = Math.min(toBox, MASTERED_BOX) as ReviewBox
  // 盒子 0 表示「今天再练一次」，间隔 0 天；用当天起始时间保证队列里排在最前
  const dueAt = box === 0 ? startOfDay(now).toISOString() : addDays(now, BOX_INTERVALS[box]).toISOString()

  return {
    box,
    dueAt,
    log: {
      at: now.toISOString(),
      grade,
      fromBox,
      toBox: box,
    },
  }
}

/** 应用一次复习，返回新的生词卡（纯函数，不写存储） */
export function reviewEntry(entry: VocabEntry, grade: ReviewGrade, now: Date = new Date()): VocabEntry {
  const { box, dueAt, log } = scheduleNext(entry, grade, now)
  return {
    ...entry,
    box,
    dueAt,
    reviews: [...entry.reviews, log],
  }
}

/** 是否到期（含已过期） */
export function isDue(entry: VocabEntry, now: Date = new Date()): boolean {
  if (entry.box >= MASTERED_BOX && entry.reviews.length > 0) {
    return new Date(entry.dueAt).getTime() <= now.getTime()
  }
  return new Date(entry.dueAt).getTime() <= now.getTime()
}

/** 今日待复习队列：到期 + 新词（按到期时间升序，新词优先排在前面更有成就感） */
export function buildReviewQueue(entries: VocabEntry[], now: Date = new Date()): VocabEntry[] {
  return entries
    .filter((entry) => isDue(entry, now))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
}

/** 已掌握的卡片数（日历统计展示用） */
export function countMastered(entries: VocabEntry[]): number {
  return entries.filter((e) => e.box >= MASTERED_BOX).length
}

/**
 * 按天聚合「复习次数」，用于日历热力格。
 * key 为 YYYY-MM-DD（本地时区），value 为当天复习张数。
 */
export function reviewCountByDay(entries: VocabEntry[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const entry of entries) {
    for (const review of entry.reviews) {
      const key = dayKey(review.at)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
  }
  return map
}

/** 按天聚合「新增生词数」，日历上通常和复习数一起展示 */
export function addedCountByDay(entries: VocabEntry[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const entry of entries) {
    const key = dayKey(entry.createdAt)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

/**
 * 生成某月的日历网格（含前后补齐的空格）。
 * 返回 42 格（6 行 × 7 列）便于固定高度渲染。
 */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const offset = first.getDay() // 0=周日
  const start = addDays(first, -offset)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
