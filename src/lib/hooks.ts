/**
 * 把 storage 订阅包成 React hook。
 *
 * 用 useState + 订阅而不是直接读 localStorage，是为了让「生词本新增」这类操作
 * 能同时刷新阅读区的下划线、侧栏计数、复习队列 —— 否则每个组件都要自己监听。
 *
 * ⚠️ 组员：任何需要显示数据的组件都用这里的 hook，
 *     不要 `const data = articlesStore.all()` 直接写在组件里（不会触发重渲染）。
 */

import { useCallback, useEffect, useState } from 'react'
import type { Article, ReadingProgress, Settings, VocabEntry } from '@/types'
import {
  articlesStore,
  progressStore,
  settingsStore,
  vocabStore,
} from './storage'

/** 通用：读一个集合 + 订阅它的变化 */
function useCollection<T>(get: () => T, subscribe: (fn: () => void) => () => void): T {
  // useState 的惰性初始值已经读了一次 storage，effect 里只负责「之后的变化」
  const [value, setValue] = useState<T>(get)

  useEffect(() => subscribe(() => setValue(get())), [get, subscribe])

  return value
}

export function useArticles(): Article[] {
  return useCollection<Article[]>(articlesStore.all, articlesStore.subscribe)
}

export function useVocab(): VocabEntry[] {
  return useCollection<VocabEntry[]>(vocabStore.all, vocabStore.subscribe)
}

export function useProgressList(): ReadingProgress[] {
  return useCollection<ReadingProgress[]>(progressStore.all, progressStore.subscribe)
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = useCollection<Settings>(settingsStore.get, settingsStore.subscribe)

  const update = useCallback((patch: Partial<Settings>) => {
    settingsStore.save({ ...settingsStore.get(), ...patch })
  }, [])

  return [settings, update]
}
