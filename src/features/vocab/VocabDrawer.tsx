/**
 * 生词抽屉（模块 B · 增强版）。
 *
 * 在基线（列表 / 释义 / 原句 / 来源标签 / 删除 / 回到原文）之上新增：
 *   · 搜索：按单词 / 词元 / 中文释义 / 英文释义实时过滤
 *   · 筛选：按文章、按复习盒子、按标签
 *   · 批量删除：多选 + 全选（走 storage 订阅，删除后阅读区下划线立刻消失）
 *   · 标签：给生词打标签、移除标签、按标签筛选（写入 VocabEntry.tags）
 *   · 导出 CSV：带 UTF-8 BOM，Excel 打开中文不乱码
 *
 * 约定：本文件只依赖公共契约（types / lib），不修改 App.tsx 与 Reader.tsx。
 */

import { useMemo, useState } from 'react'
import type { VocabEntry } from '@/types'
import { DICT_SOURCE_LABEL } from '@/lib/dict'
import { vocabStore } from '@/lib/storage'
import './vocab.css'

interface Props {
  open: boolean
  entries: VocabEntry[]
  onClose: () => void
  onOpenArticle: (articleId: string) => void
}

/** CSV 单元格转义：含逗号 / 引号 / 换行时用双引号包裹，内部引号翻倍 */
function csvCell(value: string): string {
  const s = String(value ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function VocabDrawer({ open, entries, onClose, onOpenArticle }: Props) {
  const [query, setQuery] = useState('')
  const [articleFilter, setArticleFilter] = useState('')
  const [boxFilter, setBoxFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({})

  // 文章下拉选项：从生词里反推「哪些文章有生词」
  const articleOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const e of entries) seen.set(e.context.articleId, e.context.articleTitle)
    return Array.from(seen.entries())
  }, [entries])

  // 标签下拉选项：汇总所有生词已有的标签并去重
  const tagOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const e of entries) for (const t of e.tags ?? []) seen.add(t)
    return Array.from(seen).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
  }, [entries])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((e) => {
      if (q) {
        const haystack = `${e.word} ${e.lemma} ${e.glossZh} ${e.glossEn ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (articleFilter && e.context.articleId !== articleFilter) return false
      if (boxFilter !== '' && e.box !== Number(boxFilter)) return false
      if (tagFilter && !(e.tags ?? []).includes(tagFilter)) return false
      return true
    })
  }, [entries, query, articleFilter, boxFilter, tagFilter])

  const selectedCount = filtered.reduce((n, e) => n + (selected.has(e.id) ? 1 : 0), 0)
  const allSelected = filtered.length > 0 && selectedCount === filtered.length

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) filtered.forEach((e) => next.delete(e.id))
      else filtered.forEach((e) => next.add(e.id))
      return next
    })
  }

  function deleteSelected() {
    if (selectedCount === 0) return
    vocabStore.save(entries.filter((e) => !selected.has(e.id)))
    setSelected(new Set())
  }

  /** 加标签。读最新 store 再写，避免「回车 + 失焦」连续触发时用旧快照覆盖 */
  function addTag(entryId: string, raw: string) {
    const tag = raw.trim()
    if (!tag) return
    const entry = vocabStore.all().find((e) => e.id === entryId)
    if (!entry) return
    const tags = entry.tags ?? []
    if (tags.includes(tag)) return
    vocabStore.upsert({ ...entry, tags: [...tags, tag] })
  }

  function removeTag(entryId: string, tag: string) {
    const entry = vocabStore.all().find((e) => e.id === entryId)
    if (!entry) return
    vocabStore.upsert({ ...entry, tags: (entry.tags ?? []).filter((t) => t !== tag) })
  }

  function exportCsv() {
    const header = ['word', 'lemma', 'pos', 'glossZh', 'source', 'article', 'createdAt', 'box']
    const lines = filtered.map((e) =>
      [
        e.word,
        e.lemma,
        e.pos ?? '',
        e.glossZh,
        DICT_SOURCE_LABEL[e.glossSource],
        e.context.articleTitle,
        e.createdAt,
        String(e.box),
      ]
        .map(csvCell)
        .join(','),
    )
    const csv = '\uFEFF' + [header.join(','), ...lines].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const d = new Date()
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const a = document.createElement('a')
    a.href = url
    a.download = `生词本-${stamp}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!open) return null

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <section className="panel" role="dialog" aria-modal="true" aria-label="生词本">
        <div className="panel__head">
          <span className="panel__title">生词本</span>
          <span className="tag">
            {filtered.length === entries.length
              ? `${entries.length} 张卡`
              : `${filtered.length} / ${entries.length} 张卡`}
          </span>
          <button className="btn btn--ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="panel__body">
          <div className="vocab-toolbar">
            <div className="field vocab-toolbar__search">
              <label htmlFor="vocab-search">搜索</label>
              <input
                id="vocab-search"
                type="search"
                placeholder="输入单词或释义…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="vocab-article">文章</label>
              <select id="vocab-article" value={articleFilter} onChange={(e) => setArticleFilter(e.target.value)}>
                <option value="">全部文章</option>
                {articleOptions.map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="vocab-box">盒子</label>
              <select id="vocab-box" value={boxFilter} onChange={(e) => setBoxFilter(e.target.value)}>
                <option value="">全部盒子</option>
                {[0, 1, 2, 3, 4, 5].map((box) => (
                  <option key={box} value={String(box)}>
                    盒子 {box}
                    {box === 0 ? '（新词）' : box === 5 ? '（已掌握）' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="vocab-tag">标签</label>
              <select id="vocab-tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                <option value="">全部标签</option>
                {tagOptions.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>

            <div className="vocab-toolbar__actions">
              <button className="btn btn--ghost" onClick={toggleSelectAll} aria-pressed={allSelected}>
                {allSelected ? '取消全选' : '全选'}
              </button>
              <button
                className="btn btn--ghost"
                style={selectedCount ? { color: 'var(--danger)' } : undefined}
                onClick={deleteSelected}
                disabled={selectedCount === 0}
              >
                删除选中{selectedCount ? `（${selectedCount}）` : ''}
              </button>
              <button className="btn" onClick={exportCsv}>
                导出 CSV{filtered.length ? `（${filtered.length}）` : ''}
              </button>
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="side__empty" style={{ padding: '24px 4px' }}>
              {entries.length === 0
                ? '还没有生词。在阅读区点任意一个英文单词，就能看到释义并加入生词本。'
                : '没有符合条件的生词，试试清空搜索或筛选条件。'}
            </div>
          )}

          {filtered.map((entry) => (
            <article
              key={entry.id}
              className={`card vocab-card${selected.has(entry.id) ? ' vocab-card--selected' : ''}`}
            >
              <label className="vocab-card__check" title="选择这张卡">
                <input
                  type="checkbox"
                  checked={selected.has(entry.id)}
                  onChange={() => toggleSelect(entry.id)}
                  aria-label={`选择 ${entry.word}`}
                />
              </label>

              <div className="vocab-card__main">
                <div className="card__word">
                  <b>{entry.word}</b>
                  {entry.pos && <span className="tag">{entry.pos}</span>}
                  {entry.lemma !== entry.word && <span className="tag">原形 {entry.lemma}</span>}
                  <span className="tag">盒子 {entry.box}</span>
                </div>

                <p className="card__gloss">{entry.glossZh}</p>
                {entry.glossEn && <p className="card__ctx">{entry.glossEn}</p>}

                <p className="card__ctx" title={entry.context.sentence}>
                  “{entry.context.sentence}”
                </p>

                <div className="vocab-tags">
                  {(entry.tags ?? []).map((tag) => (
                    <span key={tag} className="tag vocab-tag">
                      <button
                        type="button"
                        className="vocab-tag__name"
                        onClick={() => setTagFilter(tag)}
                        title={`只看「${tag}」`}
                      >
                        {tag}
                      </button>
                      <button
                        type="button"
                        className="vocab-tag__x"
                        onClick={() => removeTag(entry.id, tag)}
                        aria-label={`移除标签 ${tag}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    className="vocab-tag__input"
                    placeholder="＋ 标签"
                    value={tagDrafts[entry.id] ?? ''}
                    aria-label={`给 ${entry.word} 添加标签`}
                    onChange={(e) => setTagDrafts((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTag(entry.id, tagDrafts[entry.id] ?? '')
                        setTagDrafts((prev) => ({ ...prev, [entry.id]: '' }))
                      }
                    }}
                    onBlur={() => {
                      const raw = tagDrafts[entry.id]
                      if (raw && raw.trim()) addTag(entry.id, raw)
                      setTagDrafts((prev) => ({ ...prev, [entry.id]: '' }))
                    }}
                  />
                </div>

                <div className="card__row">
                  <button
                    className="btn btn--ghost"
                    style={{ padding: '2px 8px', fontSize: 12 }}
                    onClick={() => onOpenArticle(entry.context.articleId)}
                  >
                    回到原文
                  </button>
                  <button
                    className="btn btn--ghost"
                    style={{ padding: '2px 8px', fontSize: 12, color: 'var(--danger)' }}
                    onClick={() => vocabStore.removeById(entry.id)}
                  >
                    删除
                  </button>
                  <span className="hint" style={{ marginLeft: 'auto' }}>
                    {DICT_SOURCE_LABEL[entry.glossSource]}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="panel__foot">
          <span className="hint">复习队列与日历视图由【模块 C】实现 · 见 docs/TEAM.md</span>
        </div>
      </section>
    </>
  )
}
