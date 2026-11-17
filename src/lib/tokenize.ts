/** AI-assisted: 初稿由 DeepSeek（2026-11-17）生成，人工修改点见 docs/AI_USAGE.md 第 3 节。 */
/**
 * ============================================================================
 *  文本处理：切段 / 切句 / 切词（全部带字符区间）
 * ============================================================================
 *
 *  这一层被三个功能同时依赖，因此：
 *  1. 纯函数，无副作用，不碰 storage —— 方便单测；
 *  2. 所有结果都带 `start`/`end` 字符偏移，这样「点词」「逐句高亮」「标注成分」
 *     都能在同一份正文上叠加，不需要各自再切一遍文本（切法不一致就会错位）。
 *
 *  ⚠️ 组员：需要句子/单词列表时请调用这里，不要自己写 split('。')。
 * ============================================================================
 */

export interface Span {
  start: number
  end: number
  text: string
}

export interface WordSpan extends Span {
  /** 是否为可查词的英文单词（标点、空格为 false，用于渲染时的分段） */
  isWord: boolean
}

/** 常见缩写，句号后不切句（否则 "Mr. Smith" 会被切成两句） */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'al',
  'e.g', 'i.e', 'cf', 'fig', 'no', 'vol', 'ch', 'p', 'pp', 'approx',
  'inc', 'ltd', 'co', 'corp', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul',
  'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'u.s', 'u.k', 'a.m', 'p.m',
])

const SENTENCE_END = /[.!?…]/

/** 把一段原文按空行 / 单换行切成段落，顺带压缩多余空白 */
export function splitParagraphs(raw: string): string[] {
  return raw
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    // 单换行在网页复制来的文本里通常表示同一段的软换行
    .map((block) => block.replace(/\n+/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter((block) => block.length > 0)
}

/**
 * 切句。返回每句在**整段文本**中的字符区间。
 * 处理了：缩写、小数、引号收尾、连续标点（?!、"..."）。
 */
export function splitSentences(text: string): Span[] {
  const result: Span[] = []
  let cursor = 0

  for (let i = 0; i < text.length; i += 1) {
    if (!SENTENCE_END.test(text[i])) continue

    // 吞掉连续的结束标点与紧跟的引号/括号，避免 "said." 后再切一次
    let end = i + 1
    while (end < text.length && /[.!?…"'’”)\]]/.test(text[end])) end += 1

    const rest = text.slice(end)
    const isEndOfText = rest.trim().length === 0
    const nextChar = rest.match(/^\s*(.)/)?.[1] ?? ''

    // 后面不是「空白 + 大写/引号/数字」就不像句子边界
    const looksLikeBoundary = isEndOfText || /^["'“‘([]?[A-Z0-9]/.test(nextChar)

    if (!looksLikeBoundary) {
      i = end - 1
      continue
    }

    // 跳过 "Mr. Smith" / "e.g. this" / "3.14" 这类假边界
    if (!isEndOfText && isAbbreviationBoundary(text, end) === false) {
      i = end - 1
      continue
    }

    const slice = text.slice(cursor, end).trim()
    if (slice.length > 0) {
      const leading = text.slice(cursor, end).length - text.slice(cursor, end).trimStart().length
      result.push({
        start: cursor + leading,
        end,
        text: slice,
      })
    }
    cursor = end
    i = end - 1
  }

  // 收尾：剩下没被标点结束的部分也算一句
  if (cursor < text.length) {
    const tail = text.slice(cursor)
    if (tail.trim().length > 0) {
      const leading = tail.length - tail.trimStart().length
      result.push({
        start: cursor + leading,
        end: text.length,
        text: tail.trim(),
      })
    }
  }

  return result
}

/** 判断句号前那个词是否缩写 / 是否为数字小数点 */
function isAbbreviationBoundary(text: string, end: number): boolean {
  const head = text.slice(Math.max(0, end - 12), end)
  // 数字后接句号：3.14 / $2.5 —— 保留原样不切
  if (/\d\.$/.test(head)) return false

  const wordMatch = head.match(/([A-Za-z.]+)\.$/)
  if (!wordMatch) return true

  const token = wordMatch[1].toLowerCase().replace(/\.$/, '')
  return !ABBREVIATIONS.has(token)
}

const WORD_RE = /[A-Za-z][A-Za-z'’-]*/g

/**
 * 切词。返回连续片段（含标点/空格），isWord 决定该段是可点选的单词还是普通文本。
 * 渲染时按顺序 map 即可，不需要关心空白丢失。
 */
export function tokenizeWords(text: string): WordSpan[] {
  const spans: WordSpan[] = []
  let last = 0

  for (const match of text.matchAll(WORD_RE)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (start > last) {
      spans.push({ start: last, end: start, text: text.slice(last, start), isWord: false })
    }
    // 去掉末尾的连接符："readers'" → "readers"
    const cleaned = match[0].replace(/['’-]+$/, '')
    spans.push({
      start,
      end: start + cleaned.length,
      text: cleaned,
      isWord: true,
    })
    if (cleaned.length !== match[0].length) {
      spans.push({
        start: start + cleaned.length,
        end,
        text: text.slice(start + cleaned.length, end),
        isWord: false,
      })
    }
    last = end
  }

  if (last < text.length) {
    spans.push({ start: last, end: text.length, text: text.slice(last), isWord: false })
  }
  return spans
}

/** 归一化：小写、去首尾标点 */
export function normalizeWord(raw: string): string {
  return raw.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '')
}

/**
 * 极简词形还原（离线可用，不需要词典）。
 *
 * 只覆盖外刊里最常见的几种屈折变化。注意它**必然会出错**：
 * `reading` 还原成 `read` 是对的，`deteriorating` 一步还原只会得到 `deteriorat`。
 * 因此这里不追求"一步到位"，而是给出**有序候选链** `lemmaCandidates()`，
 * 由 `dict.ts` 依次去词表里试，谁命中算谁 —— 这样两种词都能命中。
 */
export function lemmaCandidates(word: string): string[] {
  const w = normalizeWord(word)
  const out: string[] = []

  const push = (candidate: string) => {
    const c = candidate.trim()
    if (c.length >= 3 && c !== w && !out.includes(c)) out.push(c)
  }

  // 复数 / 第三人称单数
  if (/ies$/.test(w)) push(w.replace(/ies$/, 'y'))
  if (/ied$/.test(w)) push(w.replace(/ied$/, 'y'))
  if (/sses$/.test(w)) push(w.replace(/es$/, ''))
  if (/[sxz]es$/.test(w)) push(w.replace(/es$/, ''))
  // -ies / -ied 已在上方处理，避免再多产生一个无意义的 "citie" 候选
  else if (/[^su]s$/.test(w) && !/(ies|ied)$/.test(w)) push(w.replace(/s$/, ''))

  // 现在分词 / 过去式：先试直接去尾，再试回填 e，最后试双写辅音还原
  if (/ing$/.test(w)) {
    const stem = w.slice(0, -3)
    push(stem)
    push(`${stem}e`)
    push(stem.replace(/([^aeiou])\1$/, '$1'))
  }
  if (/ed$/.test(w)) {
    const stem = w.slice(0, -2)
    push(stem)
    push(`${stem}e`)
    push(stem.replace(/([^aeiou])\1$/, '$1'))
  }

  // 比较级 / 最高级
  if (/ier$/.test(w)) push(w.replace(/ier$/, 'y'))
  if (/iest$/.test(w)) push(w.replace(/iest$/, 'y'))
  if (/est$/.test(w)) push(w.replace(/est$/, ''))
  if (/er$/.test(w)) push(w.replace(/er$/, ''))

  return out
}

/** 主词元猜测：候选链里最可能的那个，全不中就是小写原词本身 */
export function guessLemma(word: string): string {
  const w = normalizeWord(word)
  const [first] = lemmaCandidates(w)
  return first ?? w
}

/** 按 200 词/分钟的英文阅读速度估算分钟数，最少 1 分钟 */
export function estimateReadingMinutes(text: string): number {
  const words = tokenizeWords(text).filter((s) => s.isWord).length
  return Math.max(1, Math.round(words / 200))
}

/** 统计词数（阅读时长、每日目标都会用到） */
export function countWords(text: string): number {
  return tokenizeWords(text).filter((s) => s.isWord).length
}
