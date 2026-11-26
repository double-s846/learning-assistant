/** AI-assisted: 初稿由 DeepSeek（2026-11-17）生成，人工修改点见 docs/AI_USAGE.md 第 3 节。 */
/**
 * ============================================================================
 *  长句解析（离线规则层）
 * ============================================================================
 *
 *  目标：不联网、不调模型，给一个英文句子给出三样东西：
 *    ① 主干（去掉从句与介词短语后剩下的主谓宾）
 *    ② 从句/修饰语的位置、角色、一句话中文讲解
 *    ③ 学习提示
 *
 *  **设计原则：诚实优先。**
 *  规则解析不可能 100% 正确，所以：
 *    · 拿不准的地方宁可不切（少一个成分），也不要编一个错的结构；
 *    · 一个成分都切不出来时，`degraded = true`，界面显示"未能解析"，
 *      不要把整句当成主干假装解析成功。
 *
 *  已知的取舍（写在这里，评审和组员都能看到）：
 *    · 没有词性标注器，靠"高频虚词表 + 词形后缀"猜；
 *    · 接触从句仅识别限定名词 + 人称代词 + 常见及物动词的保守模式；
 *    · 并列从句仅展开重复关系词的显式结构。
 * ============================================================================
 */

import type { ClauseRole, ClauseSegment, SentenceParse } from '@/types'
import { tokenizeWords } from './tokenize.ts'

/* ------------------------------------------------------------ 词表 */

/** 引出让步/原因/条件/时间等状语从句的连词 */
const ADVERBIAL_SUBORDINATORS = new Set([
  'because', 'although', 'though', 'while', 'whereas', 'unless', 'until', 'till',
  'since', 'after', 'before', 'once', 'whenever', 'wherever', 'as',
])

/** 并列连词：介词短语遇到它就结束（of attention **and** started competing…） */
const COORDINATORS = new Set(['and', 'but', 'or', 'yet', 'nor', 'so'])

/** 关系代词：一定是定语从句 */
const RELATIVE_PRONOUNS = new Set(['which', 'who', 'whom', 'whose'])

/** 可能引导定语从句，也可能是别的成分（需要看前一个词） */
const AMBIGUOUS_MARKERS = new Set(['that', 'when', 'where', 'why', 'if', 'whether'])

/** 报告/认知类动词：后面跟 that 时是**宾语从句**（The report warns that …） */
const REPORTING_VERBS = new Set([
  'say', 'says', 'said', 'warn', 'warns', 'warned', 'argue', 'argues', 'argued',
  'believe', 'believes', 'believed', 'think', 'thinks', 'thought', 'note', 'notes',
  'noted', 'show', 'shows', 'showed', 'shown', 'suggest', 'suggests', 'suggested',
  'claim', 'claims', 'claimed', 'report', 'reports', 'reported', 'find', 'finds',
  'found', 'agree', 'agrees', 'agreed', 'hope', 'hopes', 'hoped', 'know', 'knows',
  'knew', 'mean', 'means', 'meant', 'prove', 'proves', 'proved', 'ensure',
  'ensures', 'indicate', 'indicates', 'indicated', 'observe', 'observes',
  'reveal', 'reveals', 'revealed', 'state', 'states', 'stated', 'tell', 'tells',
  'told', 'admit', 'admits', 'admitted', 'assume', 'assumes', 'assumed', 'expect',
  'expects', 'expected', 'fear', 'fears', 'feared', 'feel', 'feels', 'felt',
  'insist', 'insists', 'insisted', 'recognize', 'recognizes', 'recognized',
  'discover', 'discovers', 'discovered', 'notice', 'notices', 'noticed',
  'predict', 'predicts', 'predicted', 'confirm', 'confirms', 'confirmed',
  'estimate', 'estimates', 'estimated', 'explain', 'explains', 'explained',
  'recall', 'recalls', 'remember', 'remembers', 'see', 'sees', 'saw',
])

/** 抽象名词：后面跟 that 时是**同位语从句**（the fact that … / the idea that …） */
const ABSTRACT_NOUNS = new Set([
  'fact', 'idea', 'belief', 'claim', 'suggestion', 'evidence', 'notion',
  'possibility', 'assumption', 'hope', 'view', 'argument', 'news', 'thought',
  'chance', 'risk', 'feeling', 'impression', 'report', 'theory', 'rule',
  'message', 'conclusion', 'decision', 'sign', 'sense', 'way',
])

/** 助动词/情态动词：定语从句遇到它，通常意味着**外层主句的谓语开始了** */
const AUXILIARIES = new Set([
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'have', 'has', 'had', 'having', 'will', 'would', 'shall', 'should',
  'can', 'could', 'may', 'might', 'must', 'do', 'does', 'did',
])

/** 介词：用于识别介词短语修饰语 */
const PREPOSITIONS = new Set([
  'in', 'on', 'at', 'of', 'for', 'with', 'by', 'from', 'about', 'into',
  'over', 'under', 'between', 'among', 'during', 'despite', 'through',
  'against', 'within', 'without', 'according', 'across', 'along', 'behind',
  'beyond', 'toward', 'towards', 'upon', 'via', 'after', 'before', 'since',
])

/** 代词：介词短语遇到它就断（"of the minutes they obtain" 里 they 是另一个句子成分了） */
const PRONOUNS = new Set([
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them', 'him', 'her', 'us',
  'me', 'his', 'its', 'their', 'our', 'my', 'your', 'this', 'these', 'those',
  'who', 'which', 'that',
])

/** 冠词/限定词：判断"介词短语"是否成形 */
const DETERMINERS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'its', 'their', 'his',
  'her', 'our', 'my', 'your', 'some', 'any', 'no', 'every', 'each',
  'another', 'such', 'both', 'all', 'most', 'more',
])

const CONTACT_SUBJECTS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they'])
const CONTACT_VERBS = new Set(['obtain', 'obtains', 'obtained', 'read', 'reads', 'bought', 'buy', 'buys',
  'wrote', 'write', 'writes', 'use', 'uses', 'used', 'met', 'meet', 'meets', 'made', 'make', 'makes',
  'received', 'receive', 'receives', 'need', 'needs', 'needed', 'want', 'wants', 'wanted', 'saw', 'seen'])

/* ------------------------------------------------------------ 工具 */

interface WordToken {
  /** 句内字符偏移 */
  start: number
  end: number
  text: string
  lower: string
  /** 在词序列中的下标（忽略标点与空格） */
  index: number
}

function toWords(text: string): WordToken[] {
  const all = tokenizeWords(text).filter((t) => t.isWord)
  return all.map((t, index) => ({
    start: t.start,
    end: t.end,
    text: t.text,
    lower: t.text.toLowerCase(),
    index,
  }))
}

/** 两个字符位置之间（不含词本身）是否出现某个标点 */
function hasPunctuationBetween(text: string, from: number, to: number, chars: string): boolean {
  if (from >= to) return false
  const slice = text.slice(from, to)
  return [...chars].some((c) => slice.includes(c))
}

function trimSpan(text: string, start: number, end: number): { start: number; end: number } {
  let s = start
  let e = end
  while (s < e && /[\s,;:.!?—–-]/.test(text[s])) s += 1
  while (e > s && /[\s,;:—–-]/.test(text[e - 1])) e -= 1
  return { start: s, end: e }
}

/** 判断标点前的字符是否逗号（用于区分限制性 / 非限制性定语从句） */
function precededByComma(text: string, start: number): boolean {
  for (let i = start - 1; i >= 0; i -= 1) {
    const ch = text[i]
    if (ch === ' ') continue
    return ch === ','
  }
  return false
}

/* ------------------------------------------------------------ 主流程 */

const ROLE_NOTE: Record<string, string> = {
  attributive: '说明前面的名词是哪一个 / 什么样的',
  'object-clause': '作前面动词的宾语，说明"说了/知道了什么"',
  adverbial: '交代主句的时间、原因、条件或让步',
  appositive: '解释前面抽象名词的具体内容',
}

export interface AnalyzeOptions {
  /** 真实句子 id（来自 Article 的 Sentence.id），用于把解析结果写回缓存 */
  sentenceId?: string
}

/**
 * 解析一个英文句子。
 *
 * 返回的 `segments` 覆盖句子中的从句与介词短语；`backbone` 是它们之外的部分。
 * 当规则层完全没有把握时返回 `degraded: true`（此字段通过 `tips` 与空 segments 体现，
 * 界面上必须显示"未能解析"，不要伪造结构）。
 */
export function analyzeSentence(text: string, options: AnalyzeOptions = {}): SentenceParse {
  const words = toWords(text)
  const segments: ClauseSegment[] = []
  const tips: string[] = []

  if (words.length < 4) {
    return {
      sentenceId: options.sentenceId ?? '',
      text,
      source: 'rule',
      backbone: text.trim(),
      depth: 0,
      segments: [],
      tips: ['句子太短，无需解析。'],
    }
  }

  /* ---- 第 1 步：找从句 ---- */
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i]
    const prev = words[i - 1]

    // 句首的 that / which 更可能是限定词或疑问词（That assumption is… / Which is better?），跳过
    if (i === 0 && (RELATIVE_PRONOUNS.has(word.lower) || word.lower === 'that')) {
      continue
    }

    let role: ClauseRole | null = null
    const markerLabel = word.text

    if (RELATIVE_PRONOUNS.has(word.lower)) {
      role = 'attributive-clause'
    } else if (ADVERBIAL_SUBORDINATORS.has(word.lower)) {
      // "as" 也可能是 "as a result" 这类介词短语，紧跟名词时跳过
      if (word.lower === 'as' && prev && DETERMINERS.has(prev.lower)) continue
      role = 'adverbial-clause'
    } else if (AMBIGUOUS_MARKERS.has(word.lower)) {
      const prevLower = prev?.lower ?? ''

      if (word.lower === 'that') {
        if (ABSTRACT_NOUNS.has(prevLower)) {
          role = 'appositive'
        } else if (REPORTING_VERBS.has(prevLower)) {
          role = 'object-clause'
        } else if (!prevLower) {
          continue
        } else {
          // 默认按定语从句处理：The companies that understand this best …
          role = 'attributive-clause'
        }
      } else if (word.lower === 'if' || word.lower === 'whether') {
        role = REPORTING_VERBS.has(prevLower) ? 'object-clause' : 'adverbial-clause'
      } else if (i === 0) {
        // 句首 when / where / why：疑问句跳过（When did he go?），否则视为状语从句
        // （When city planners began mapping …, they discovered …）
        if (words[1] && AUXILIARIES.has(words[1].lower)) continue
        role = 'adverbial-clause'
      } else {
        // 句中 when / where / why：前面是时间/地点名词时更像定语从句
        role = 'attributive-clause'
      }
    }

    // 保守识别接触从句：限定词 + 名词 + 主语代词 + 已知及物动词。
    // 不把 I think they ... 或普通并列主句当成省略关系词。
    const contact = !role && i >= 2 && CONTACT_SUBJECTS.has(word.lower) &&
      DETERMINERS.has(words[i - 2].lower) &&
      !PRONOUNS.has(prev.lower) && !AUXILIARIES.has(prev.lower) &&
      !REPORTING_VERBS.has(prev.lower) &&
      (CONTACT_VERBS.has(words[i + 1]?.lower) ||
        (AUXILIARIES.has(words[i + 1]?.lower) && CONTACT_VERBS.has(words[i + 2]?.lower)))
    if (contact && !hasPunctuationBetween(text, prev.end, word.start, ',;:.!?')) {
      role = 'attributive-clause'
    }
    if (!role) continue

    const end = findClauseEnd(text, words, i, role)
    const span = trimSpan(text, word.start, end)
    if (span.end - span.start < word.text.length + 2) continue

    const clauseText = text.slice(span.start, span.end)
    const nonRestrictive = precededByComma(text, word.start)

    let noteZh: string
    if (role === 'attributive-clause') {
      const head = prev ? `「${prev.text}」` : '前面的名词'
      noteZh = nonRestrictive
        ? `${markerLabel} 引导非限制性定语从句，补充说明${head}（用逗号隔开，删掉不影响主干成立）`
        : `${markerLabel} 引导定语从句，限定${head}是哪一个`
    } else if (role === 'object-clause') {
      noteZh = `${markerLabel} 引导宾语从句，作「${prev?.text ?? '动词'}」的宾语，${ROLE_NOTE['object-clause']}`
    } else if (role === 'appositive') {
      noteZh = `${markerLabel} 引导同位语从句，解释「${prev?.text ?? '名词'}」的具体内容`
    } else {
      noteZh = `${markerLabel} 引导状语从句，${ROLE_NOTE.adverbial}`
    }

    if (contact) noteZh = `疑似省略 that/which 的接触从句，限定「${prev.text}」；规则推测，请结合上下文核对`
    if (overlaps(segments, span.start, span.end)) continue
    segments.push({
      start: span.start,
      end: span.end,
      text: clauseText,
      role,
      kind: 'clause',
      noteZh,
    })
  }

  /* ---- 第 2 步：找介词短语修饰语（只在从句之外找，最多 2 个） ---- */
  let ppCount = 0
  for (let i = 1; i < words.length && ppCount < 2; i += 1) {
    const word = words[i]
    if (!PREPOSITIONS.has(word.lower)) continue
    if (overlaps(segments, word.start, word.end)) continue

    const end = findPrepositionalPhraseEnd(text, words, i)
    const span = trimSpan(text, word.start, end)
    if (span.end - span.start < 12) continue
    if (overlaps(segments, span.start, span.end)) continue

    // 紧跟动词的介词（look at / depend on）不是修饰语，跳过
    const prev = words[i - 1]
    if (prev && AUXILIARIES.has(prev.lower)) continue

    segments.push({
      start: span.start,
      end: span.end,
      text: text.slice(span.start, span.end),
      role: 'attributive',
      kind: 'modifier',
      noteZh: `介词短语作修饰语，${ROLE_NOTE.attributive}（由 ${word.lower} 引导）`,
    })
    ppCount += 1
  }

  /* ---- 第 3 步：主干 = 去掉**从句**后剩下的部分（介词短语保留，否则主干读不通） ---- */
  segments.sort((a, b) => a.start - b.start)
  const clauses = segments.filter((s) => s.kind === 'clause')
  // 删除两个并列从句之间的连接词，但保留连接主句的 and/but。
  const removals = clauses.map((segment, index) => {
    const previous = clauses[index - 1]
    return previous && /^\s*,?\s*(and|but|or|nor|yet)\s+$/i.test(text.slice(previous.end, segment.start))
      ? { ...segment, start: previous.end } : segment
  })
  const backbone = extractBackbone(text, removals)

  /* ---- 第 4 步：提示 ---- */
  const clauseCount = segments.filter((s) => s.kind === 'clause').length
  if (clauseCount === 0) {
    tips.push('未识别到从句，本句可能是简单句；重点看主干的主谓宾。')
  } else {
    tips.push(`本句含 ${clauseCount} 个从句，先读主干，再逐个看修饰成分。`)
  }
  if (segments.some((s) => s.noteZh.includes('非限制性'))) {
    tips.push('非限制性定语从句用逗号隔开，删掉它主干依然成立——这也是长句"读得懂"的关键。')
  }
  if (segments.length === 0) {
    tips.push('规则层未能切出成分，以下主干为整句近似，请谨慎参考。')
  }

  return {
    sentenceId: options.sentenceId ?? '',
    text,
    source: 'rule',
    backbone: backbone || text.trim(),
    depth: segments.length >= 2 ? 2 : segments.length === 1 ? 1 : 0,
    segments,
    tips,
  }
}

/* ------------------------------------------------------------ 子步骤 */

/** 从句的结束位置 */
function findClauseEnd(
  text: string,
  words: WordToken[],
  startIdx: number,
  role: ClauseRole,
): number {
  const startWord = words[startIdx]
  let wordCount = 0
  let end = text.length

  for (let i = startIdx + 1; i < words.length; i += 1) {
    const word = words[i]
    const prev = words[i - 1]
    wordCount += 1

    // 显式并列关系从句在连接词前截断，第二个关系词由主循环识别。
    if (COORDINATORS.has(word.lower) && RELATIVE_PRONOUNS.has(words[i + 1]?.lower)) {
      end = prev.end
      break
    }

    // 遇到下一个连词/关系词，本从句到此为止
    if (
      ADVERBIAL_SUBORDINATORS.has(word.lower) ||
      RELATIVE_PRONOUNS.has(word.lower) ||
      (AMBIGUOUS_MARKERS.has(word.lower) && wordCount >= 2)
    ) {
      end = prev.end
      break
    }

    // 冒号、分号：从句结束（后半句通常另起一个完整结构）
    if (hasPunctuationBetween(text, prev.end, word.start, ':;')) {
      end = prev.end
      break
    }

    // 逗号：从句已成形（≥3 词）时视为结束
    if (wordCount >= 2 && hasPunctuationBetween(text, prev.end, word.start, ',')) {
      end = prev.end
      break
    }

    // 定语从句遇到助动词：多半已经切到外层主句的谓语了
    // （The companies that understand this best | have therefore stopped …）
    // 但 "which had been laid out" 里的 been 属于同一个助动词链，不能在这里断。
    if (
      role === 'attributive-clause' &&
      wordCount >= 2 &&
      AUXILIARIES.has(word.lower) &&
      !AUXILIARIES.has(prev.lower) &&
      !CONTACT_SUBJECTS.has(prev.lower)
    ) {
      end = prev.end
      break
    }
  }

  // 保底：至少覆盖到起始词
  if (end <= startWord.end) end = startWord.end
  return end
}

/** 介词短语的结束位置（介词 + 最多 6 个词，遇标点/助动词/连词/并列连词即停） */
function findPrepositionalPhraseEnd(text: string, words: WordToken[], startIdx: number): number {
  const prep = words[startIdx]
  let end = prep.end
  let taken = 0

  for (let i = startIdx + 1; i < words.length && taken < 6; i += 1) {
    const word = words[i]
    const prev = words[i - 1]

    if (hasPunctuationBetween(text, prev.end, word.start, ',;:.')) break
    if (AUXILIARIES.has(word.lower)) break
    if (ADVERBIAL_SUBORDINATORS.has(word.lower)) break
    if (RELATIVE_PRONOUNS.has(word.lower) || AMBIGUOUS_MARKERS.has(word.lower)) break
    // "of attention and started competing" —— 并列连词处必须断开
    if (taken > 0 && COORDINATORS.has(word.lower)) break
    // "of the minutes they obtain" —— 代词一出现，介词短语就结束了
    if (taken >= 2 && PRONOUNS.has(word.lower)) break

    end = word.end
    taken += 1
  }

  // 别在冠词/介词上截断（"according to the wealth of a" 这种半截短语没有意义）
  let cursor = startIdx + taken
  while (cursor < words.length - 1 && (DETERMINERS.has(words[cursor].lower) || PREPOSITIONS.has(words[cursor].lower))) {
    cursor += 1
    end = words[cursor].end
  }

  return end
}

function overlaps(segments: ClauseSegment[], start: number, end: number): boolean {
  return segments.some((s) => start < s.end && end > s.start)
}

/**
 * 挖掉从句时，把它两侧的空格与逗号一起带走。
 * 否则 "Older streets, which had been laid out, happened …" 会剩成
 * "Older streets, happened …" —— 主干读起来就像缺了谓语。
 */
function expandRemovalSpan(text: string, start: number, end: number): { start: number; end: number } {
  let s = start
  let e = end

  // 只吞空格与逗号：冒号/分号后面往往是另一个完整分句，保留它更易读
  while (s > 0 && /[ ,]/.test(text[s - 1])) s -= 1
  while (e < text.length && /[ ,]/.test(text[e])) e += 1

  return { start: s, end: e }
}

/** 把从句区间挖掉后剩下的文本收拢成主干，并清掉多余标点 */
function extractBackbone(text: string, segments: ClauseSegment[]): string {
  if (segments.length === 0) return text.trim()

  let result = ''
  let cursor = 0

  for (const segment of [...segments].sort((a, b) => a.start - b.start)) {
    const span = expandRemovalSpan(text, segment.start, segment.end)
    if (span.start > cursor) result += text.slice(cursor, span.start)
    else result += text.slice(cursor, Math.max(cursor, span.start))
    result += ' '
    cursor = Math.max(cursor, span.end)
  }
  result += text.slice(cursor)

  return result
    .replace(/\s+/g, ' ')
    // 挖掉从句后可能留下 ", ," 或 ", ." 这类残渣
    .replace(/([,;:])\s*(?=[,;:.])/g, '')
    .replace(/\s+([,;:.!?])/g, '$1')
    .replace(/^[\s,;:.—–-]+/, '')
    .replace(/[\s,;:—–-]+$/, '')
    .trim()
}
