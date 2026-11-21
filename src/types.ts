/**
 * ============================================================================
 *  外刊学习助手 · 全组共用数据契约（Data Contract）
 * ============================================================================
 *
 *  规则（请组员务必遵守）：
 *  1. 本文件是**唯一**的业务类型来源。任何人要加字段，先改这里，并在群里说一声。
 *  2. 不要在 feature 目录里另建一套同名 interface，那会导致合并后类型冲突。
 *  3. 所有金额/时间统一用 ISO 字符串（`new Date().toISOString()`），
 *     不要在存储里放 Date 对象（JSON 往返会变成字符串，类型会骗人）。
 *  4. id 统一由 `src/lib/id.ts` 的 `createId()` 生成，不要自己拼随机数。
 *
 *  数据流：feature → lib/storage（唯一碰 localStorage 的地方）→ 浏览器
 * ============================================================================
 */

/* ------------------------------------------------------------------ 文章 */

/** 一篇导入的文章 */
export interface Article {
  id: string
  title: string
  /** 来源名称，例如 "The Economist" / "团队原创示例" */
  source: string
  /** 原文链接（原创示例可为空） */
  sourceUrl?: string
  author?: string
  /** 版权/授权说明，必须填写——这叫"来源合规" */
  license: string
  /** 导入时间，ISO 字符串 */
  importedAt: string
  /** 段落。切段在导入时一次性完成，后续所有功能都基于 paragraph.id 定位 */
  paragraphs: Paragraph[]
  /** 预估阅读时长（分钟），导入时计算一次 */
  readingMinutes: number
}

export interface Paragraph {
  id: string
  /** 在文章内的序号，从 0 开始 */
  index: number
  text: string
}

/** 句子。由 `lib/tokenize.ts` 在导入时切好并缓存，避免每次渲染重算 */
export interface Sentence {
  id: string
  paragraphId: string
  /** 句子在**段落文本**中的字符区间，用于高亮定位 */
  start: number
  end: number
  text: string
  /** 句在段落内的序号 */
  index: number
}

/* ------------------------------------------------------------------ 生词 */

/** 生词卡：用户点词后产生的一张小卡片 */
export interface VocabEntry {
  id: string
  /** 用户点到的原始词形，例如 "deteriorating" */
  word: string
  /** 归一化词元，例如 "deteriorate"；查不到时等于小写 word */
  lemma: string
  phonetic?: string
  /** 词性，如 "v." / "n." / "adj." */
  pos?: string
  /** 中文释义（必需——卡片正面） */
  glossZh: string
  /** 英文释义（可选——加分项） */
  glossEn?: string
  /** 释义来源，用于透明化展示：离线词表 / 免费词典 / 有道 / 手动填写 */
  glossSource: DictSource
  /** 出处：这个词是从哪句话里点出来的（复习时能回原文，是本题的差异点） */
  context: VocabContext
  createdAt: string
  /** 复习阶段 0–5，对应间隔重复的 6 个盒子 */
  box: ReviewBox
  /** 下次到期时间，ISO 字符串 */
  dueAt: string
  /** 复习历史，供日历与统计使用 */
  reviews: ReviewLog[]
  /** 用户手动标记的标签，如 "考研" / "TOEFL" */
  tags?: string[]
}

export interface VocabContext {
  articleId: string
  articleTitle: string
  paragraphId: string
  sentenceId: string
  /** 原句全文 */
  sentence: string
}

/** 复习盒子：0=新词，5=已掌握。间隔见 lib/srs.ts */
export type ReviewBox = 0 | 1 | 2 | 3 | 4 | 5

/** 一次复习的结果 */
export type ReviewGrade = 'again' | 'good' | 'easy'

export interface ReviewLog {
  at: string
  grade: ReviewGrade
  /** 复习前的盒子，便于回滚与统计 */
  fromBox: ReviewBox
  /** 复习后的盒子 */
  toBox: ReviewBox
}

/* ------------------------------------------------------------ 阅读进度 */

/** 一篇文章的阅读进度 */
export interface ReadingProgress {
  articleId: string
  /** 已读完的段落 id 列表（对应"阅读进度打勾"） */
  readParagraphIds: string[]
  /** 当前停留的段落 id，用于"继续阅读" */
  lastParagraphId?: string
  /** 0–100，用于环形进度 */
  percent: number
  /** 是否手动标记为「读完」 */
  finished: boolean
  updatedAt: string
}

/* ------------------------------------------------------------ 交互载荷 */

/**
 * 用户点中一个单词时，阅读器抛出的**最小上下文**。
 *
 * 为什么放在 types.ts 而不是某个 feature 里：
 * 阅读器（features/reader）不该 import 查词模块（features/vocab），
 * 否则两个模块会互相依赖，谁都不敢先改。放在公共契约里，双方都只依赖 types。
 */
export interface WordHit {
  /** 用户点到的原始词形，例如 "deteriorating" */
  word: string
  articleId: string
  articleTitle: string
  paragraphId: string
  sentenceId: string
  /** 原句全文，生词卡要沿用它作为语境 */
  sentence: string
}

/* ------------------------------------------------------------ 长句解析 */

/** 句子成分角色 */
export type ClauseRole =
  | 'main' // 主干
  | 'subject' // 主语
  | 'predicate' // 谓语
  | 'object' // 宾语
  | 'attributive' // 定语
  | 'adverbial' // 状语
  | 'object-clause' // 宾语从句
  | 'attributive-clause' // 定语从句
  | 'adverbial-clause' // 状语从句
  | 'subject-clause' // 主语从句
  | 'appositive' // 同位语
  | 'parenthesis' // 插入语
  | 'unknown'

/**
 * 成分类型：
 *  - `clause`   从句。计算主干时会被**挖掉**（挖掉后主干依然成立，这正是"先读主干"的意义）
 *  - `modifier` 修饰语（介词短语等）。主干里**保留**它，只是单独标注出来供阅读参考
 */
export type SegmentKind = 'clause' | 'modifier'

/** 一个切分出来的成分 */
export interface ClauseSegment {
  /** 该成分在**句子文本**中的字符区间 */
  start: number
  end: number
  text: string
  role: ClauseRole
  /** 从句还是修饰语 —— 决定是否从主干中剔除，也决定界面配色 */
  kind: SegmentKind
  /** 中文讲解，一句话说清这里在干什么 */
  noteZh: string
}

/** 一个句子的解析结果 */
export interface SentenceParse {
  sentenceId: string
  text: string
  /** 解析来源：规则解析（离线）或大模型增强 */
  source: 'rule' | 'llm'
  /** 主干，例如 "The report warns that ..." */
  backbone: string
  /** 中文整句翻译（可选） */
  translationZh?: string
  /** 结构层级：0=主干，1=一级修饰，2=嵌套 */
  depth: number
  segments: ClauseSegment[]
  /** 学习提示：这个词/这个语法点值得注意的地方 */
  tips?: string[]
}

/* --------------------------------------------------------------- 设置 */

/** 阅读模式：本赛题「兼顾阅读流畅性与学习深度」的落点 */
export type ReadingMode =
  /** 流畅模式：只留正文，词标注/解析全部收起 */
  | 'flow'
  /** 学习模式：生词高亮、长句标注、释义气泡全部展开 */
  | 'study'

export type ThemeMode = 'light' | 'dark' | 'sepia'

export interface Settings {
  mode: ReadingMode
  theme: ThemeMode
  /** 正文字号，px */
  fontSize: number
  /** 行高倍数 */
  lineHeight: number
  /** 是否在流畅模式下也保留下划线提示 */
  showVocabUnderline: boolean
  /** TTS 语速 0.5–2 */
  ttsRate: number
  /** TTS 音色 name（浏览器提供，跨设备不通用） */
  ttsVoice?: string
  /** 每日目标新词数，用于日历统计 */
  dailyGoal: number
}

/* ------------------------------------------------------- 查词与依赖来源 */

/**
 * 释义来源。三级降级链条：
 *   local（内置离线词表，永远可用）
 *     → free-api（dictionaryapi.dev，无需 key）
 *     → paid-api（有道/百度，需用户自己填 key）
 *     → manual（都没有时用户手填）
 */
export type DictSource = 'local' | 'free-api' | 'paid-api' | 'manual'

export interface DictResult {
  word: string
  lemma: string
  phonetic?: string
  pos?: string
  glossZh: string
  glossEn?: string
  source: DictSource
}

/* ------------------------------------------------------------- 备份 */

/** 导出/导入用的整体快照（对应"数据持久化、刷新不丢失"+"可迁移"） */
export interface BackupSnapshot {
  schemaVersion: number
  exportedAt: string
  app: 'learning-assistant'
  articles: Article[]
  vocab: VocabEntry[]
  progress: ReadingProgress[]
  settings: Settings
}
