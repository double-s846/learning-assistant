/** AI-assisted: 初稿由 DeepSeek（2026-11-17）生成，人工修改点见 docs/AI_USAGE.md 第 3 节。 */
/**
 * ============================================================================
 *  存储层 —— 全项目**唯一**直接访问 localStorage 的文件
 * ============================================================================
 *
 *  为什么集中在这里：
 *  1. 换存储方案（localStorage → IndexedDB → 后端）时只改一个文件；
 *  2. 所有 key 带命名空间 + 版本号，评测/升级不会读到脏数据；
 *  3. 统一 try/catch：浏览器隐私模式、配额满、JSON 损坏都不会让页面白屏；
 *  4. 统一订阅机制：多个组件共享同一份数据时自动同步，不用各自轮询。
 *
 *  ⚠️ 组员请注意：业务代码里**不要**再写 localStorage.setItem。
 *     需要读写数据时，用本文件导出的 read/write 或下面的领域方法。
 * ============================================================================
 */

import type {
  Article,
  BackupSnapshot,
  ReadingProgress,
  Settings,
  VocabEntry,
} from '@/types'

/** 命名空间 + schema 版本。改数据结构时把 v1 升到 v2，并写迁移函数 */
const NS = 'la:v1'

export const STORAGE_KEYS = {
  articles: `${NS}:articles`,
  vocab: `${NS}:vocab`,
  progress: `${NS}:progress`,
  settings: `${NS}:settings`,
  parseCache: `${NS}:parse-cache`,
  seeded: `${NS}:seeded`,
} as const

export const SCHEMA_VERSION = 1

/** 默认设置。新增设置项时改这里，读取时会与用户已有值合并 */
export const DEFAULT_SETTINGS: Settings = {
  mode: 'study',
  theme: 'light',
  fontSize: 18,
  lineHeight: 1.85,
  showVocabUnderline: true,
  ttsRate: 1,
  dailyGoal: 10,
}

/* ------------------------------------------------------------ 底层读写 */

type Listener = () => void
const listeners = new Map<string, Set<Listener>>()

function emit(key: string) {
  listeners.get(key)?.forEach((fn) => fn())
}

export function subscribe(key: string, fn: Listener): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set())
  listeners.get(key)!.add(fn)
  return () => listeners.get(key)?.delete(fn)
}

/** 读取并 JSON 解析；任何异常都回落到 fallback，保证页面不白屏 */
export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch (err) {
    console.warn(`[storage] 读取 ${key} 失败，已回落到默认值`, err)
    return fallback
  }
}

/** 写入并广播变更；配额满时给出可读告警而不是崩溃 */
export function write<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    emit(key)
    return true
  } catch (err) {
    console.error(`[storage] 写入 ${key} 失败（可能是存储空间已满）`, err)
    return false
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key)
    emit(key)
  } catch (err) {
    console.warn(`[storage] 删除 ${key} 失败`, err)
  }
}

/* ------------------------------------------------------- 领域级访问方法 */

export const articlesStore = {
  all: (): Article[] => read<Article[]>(STORAGE_KEYS.articles, []),
  save: (list: Article[]) => write(STORAGE_KEYS.articles, list),
  add(article: Article): Article[] {
    const next = [article, ...articlesStore.all().filter((a) => a.id !== article.id)]
    articlesStore.save(next)
    return next
  },
  removeById(id: string): Article[] {
    const next = articlesStore.all().filter((a) => a.id !== id)
    articlesStore.save(next)
    return next
  },
  subscribe: (fn: Listener) => subscribe(STORAGE_KEYS.articles, fn),
}

export const vocabStore = {
  all: (): VocabEntry[] => read<VocabEntry[]>(STORAGE_KEYS.vocab, []),
  save: (list: VocabEntry[]) => write(STORAGE_KEYS.vocab, list),
  /** 同一个 lemma 在同一个句子里只存一张卡，避免重复 */
  upsert(entry: VocabEntry): VocabEntry[] {
    const list = vocabStore.all()
    const idx = list.findIndex(
      (v) =>
        v.lemma === entry.lemma &&
        v.context.articleId === entry.context.articleId &&
        v.context.sentenceId === entry.context.sentenceId,
    )
    const next = idx >= 0 ? list.map((v, i) => (i === idx ? { ...entry, id: v.id } : v)) : [entry, ...list]
    vocabStore.save(next)
    return next
  },
  removeById(id: string): VocabEntry[] {
    const next = vocabStore.all().filter((v) => v.id !== id)
    vocabStore.save(next)
    return next
  },
  subscribe: (fn: Listener) => subscribe(STORAGE_KEYS.vocab, fn),
}

export const progressStore = {
  all: (): ReadingProgress[] => read<ReadingProgress[]>(STORAGE_KEYS.progress, []),
  save: (list: ReadingProgress[]) => write(STORAGE_KEYS.progress, list),
  get(articleId: string): ReadingProgress {
    const found = progressStore.all().find((p) => p.articleId === articleId)
    return (
      found ?? {
        articleId,
        readParagraphIds: [],
        percent: 0,
        finished: false,
        updatedAt: new Date().toISOString(),
      }
    )
  },
  upsert(next: ReadingProgress): ReadingProgress[] {
    const list = progressStore.all()
    const idx = list.findIndex((p) => p.articleId === next.articleId)
    const merged = idx >= 0 ? list.map((p, i) => (i === idx ? next : p)) : [...list, next]
    progressStore.save(merged)
    return merged
  },
  subscribe: (fn: Listener) => subscribe(STORAGE_KEYS.progress, fn),
}

export const settingsStore = {
  get(): Settings {
    const saved = read<Partial<Settings>>(STORAGE_KEYS.settings, {})
    // 与默认值合并：新版本加的字段自动有值
    return { ...DEFAULT_SETTINGS, ...saved }
  },
  save(next: Settings): Settings {
    write(STORAGE_KEYS.settings, next)
    return next
  },
  subscribe: (fn: Listener) => subscribe(STORAGE_KEYS.settings, fn),
}

/* ------------------------------------------------------------ 备份迁移 */

export function exportSnapshot(): BackupSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'learning-assistant',
    articles: articlesStore.all(),
    vocab: vocabStore.all(),
    progress: progressStore.all(),
    settings: settingsStore.get(),
  }
}

/** 导入快照。返回是否成功，并把失败原因交给调用方展示 */
export function importSnapshot(raw: unknown): { ok: boolean; message: string } {
  const snap = raw as Partial<BackupSnapshot> | null
  if (!snap || snap.app !== 'learning-assistant') {
    return { ok: false, message: '这不是本应用导出的备份文件' }
  }
  if (typeof snap.schemaVersion !== 'number' || snap.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, message: '备份版本比当前应用更新，请先升级应用' }
  }
  if (!Array.isArray(snap.articles) || !Array.isArray(snap.vocab)) {
    return { ok: false, message: '备份内容不完整' }
  }

  articlesStore.save(snap.articles)
  vocabStore.save(snap.vocab)
  progressStore.save(Array.isArray(snap.progress) ? snap.progress : [])
  settingsStore.save({ ...DEFAULT_SETTINGS, ...(snap.settings ?? {}) })
  return { ok: true, message: '导入成功' }
}

export function clearAll(): void {
  Object.values(STORAGE_KEYS).forEach((key) => remove(key))
}

/** 首次启动标记：用来判断是否需要灌入示例文章 */
export function isSeeded(): boolean {
  return read<boolean>(STORAGE_KEYS.seeded, false)
}

export function markSeeded(): void {
  write(STORAGE_KEYS.seeded, true)
}
