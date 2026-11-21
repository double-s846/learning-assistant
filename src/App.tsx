/**
 * 应用外壳：负责「有哪篇文章、当前模式、数据从哪来」这三件事。
 *
 * 有意保持 App.tsx 很薄：业务能力都在 features/ 下，
 * 这样多个同学并行开发时不会都来改同一个文件（合并冲突的主要来源）。
 */

import { useEffect, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { WordSelection } from '@/features/vocab/WordPopover'
import { WordPopover } from '@/features/vocab/WordPopover'
import { VocabDrawer } from '@/features/vocab/VocabDrawer'
import { Reader } from '@/features/reader/Reader'
import { Sidebar } from '@/features/library/Sidebar'
import { ImportDialog } from '@/features/library/ImportDialog'
import { SettingsMenu } from '@/features/settings/SettingsMenu'
import { ParsePanel } from '@/features/parse/ParsePanel'
import { ReviewPanel } from '@/features/review/ReviewPanel'
import { SAMPLE_ARTICLES } from '@/data/sample-articles'
import { articleFromSeed, buildArticle } from '@/lib/article'
import type { ArticleInput } from '@/lib/article'
import { useArticles, useProgressList, useSettings, useVocab } from '@/lib/hooks'
import { articlesStore, isSeeded, markSeeded, progressStore, pdfFileStore } from '@/lib/storage'
import { buildReviewQueue } from '@/lib/srs'

import '@/styles/app.css'

export default function App() {
  const articles = useArticles()
  const vocab = useVocab()
  const progressList = useProgressList()
  const [settings, updateSettings] = useSettings()

  const [currentId, setCurrentId] = useState<string | undefined>(undefined)
  const [importOpen, setImportOpen] = useState(false)
  const [vocabOpen, setVocabOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selection, setSelection] = useState<WordSelection | null>(null)
  const [parseTarget, setParseTarget] = useState<{ sentenceId: string; text: string } | null>(null)

  /* 首次启动灌入示例文章：保证评委打开就有内容可读 */
  useEffect(() => {
    if (isSeeded()) return
    if (articlesStore.all().length > 0) {
      markSeeded()
      return
    }
    SAMPLE_ARTICLES.forEach((seed) => articlesStore.add(articleFromSeed(seed)))
    markSeeded()
  }, [])

  /* 主题挂到 <html> 上，CSS 变量统一生效 */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  const article = articles.find((a) => a.id === currentId) ?? articles[0]
  const progress = progressList.find((p) => p.articleId === article?.id)
  const dueCount = buildReviewQueue(vocab).length

  function toggleParagraph(paragraphId: string) {
    if (!article) return
    const current = progressStore.get(article.id)
    const already = current.readParagraphIds.includes(paragraphId)
    const readParagraphIds = already
      ? current.readParagraphIds.filter((id) => id !== paragraphId)
      : [...current.readParagraphIds, paragraphId]

    const total = article.paragraphs.length
    const percent = Math.round((readParagraphIds.length / Math.max(1, total)) * 100)

    progressStore.upsert({
      ...current,
      readParagraphIds,
      percent,
      finished: readParagraphIds.length >= total,
      lastParagraphId: paragraphId,
      updatedAt: new Date().toISOString(),
    })
  }

  async function handleImport(input: ArticleInput) {
    const next = buildArticle(input)
    if (input.pdf && input.pdfFile) await pdfFileStore.save(input.pdf.fileId, input.pdfFile)
    if (!articlesStore.save([next, ...articlesStore.all()])) {
      if (input.pdf) await pdfFileStore.remove(input.pdf.fileId)
      throw new Error('文章保存失败，可能是本机浏览器存储空间不足。请先导出备份，或缩短正文后重试。')
    }
    setCurrentId(next.id)
  }

  function handleWordClick(
    payload: Omit<WordSelection, 'x' | 'y'>,
    event: ReactMouseEvent<HTMLSpanElement>,
  ) {
    const rect = event.currentTarget.getBoundingClientRect()
    setSelection({
      ...payload,
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
  }

  return (
    <div className="app">
      <Sidebar
        articles={articles}
        progressList={progressList}
        currentId={article?.id}
        vocabCount={vocab.length}
        dueCount={dueCount}
        onSelect={setCurrentId}
        onImport={() => setImportOpen(true)}
        onOpenVocab={() => setVocabOpen(true)}
      />

      <main className="main">
        <header className="top">
          <div className="top__meta">
            {article ? (
              <>
                <strong>{article.source}</strong>
                <span>·</span>
                <span>{progress?.percent ?? 0}% 已读</span>
              </>
            ) : (
              <span>还没有文章</span>
            )}
          </div>

          <div className="top__spacer" />

          <div className="seg" role="group" aria-label="阅读模式">
            <button
              aria-pressed={settings.mode === 'flow'}
              onClick={() => updateSettings({ mode: 'flow' })}
              title="只留正文，便于连续阅读"
            >
              流畅
            </button>
            <button
              aria-pressed={settings.mode === 'study'}
              onClick={() => updateSettings({ mode: 'study' })}
              title="展开生词标注与长句解析"
            >
              学习
            </button>
          </div>

          <button className="btn" onClick={() => setVocabOpen(true)}>
            生词本 {vocab.length}
          </button>

          <button className="btn" onClick={() => setImportOpen(true)}>
            导入文章
          </button>

          <button
            className="btn"
            aria-pressed={reviewOpen}
            onClick={() => setReviewOpen(true)}
          >
            复习{dueCount > 0 ? ` ${dueCount}` : ''}
          </button>

          <button
            className="btn btn--ghost"
            aria-label="设置"
            aria-pressed={settingsOpen}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            ⚙ 设置
          </button>
        </header>

        {article ? (
          <Reader
            article={article}
            settings={settings}
            vocab={vocab}
            readParagraphIds={progress?.readParagraphIds ?? []}
            onWordClick={handleWordClick}
            onToggleParagraph={toggleParagraph}
            onSentenceClick={(sentenceId, text) => setParseTarget({ sentenceId, text })}
          />
        ) : (
          <div className="empty">
            <div>
              <h2>还没有文章</h2>
              <p>示例文章正在加载。也可以点左侧「导入文章」粘贴一篇外刊正文。</p>
              <button className="btn btn--primary" onClick={() => setImportOpen(true)}>
                导入文章
              </button>
            </div>
          </div>
        )}
      </main>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onSubmit={handleImport} />

      <VocabDrawer
        open={vocabOpen}
        entries={vocab}
        onClose={() => setVocabOpen(false)}
        onOpenArticle={(id) => {
          setCurrentId(id)
          setVocabOpen(false)
        }}
      />

      {reviewOpen && (
        <ReviewPanel
          entries={vocab}
          settings={settings}
          onClose={() => setReviewOpen(false)}
        />
      )}

      <SettingsMenu
        open={settingsOpen}
        settings={settings}
        onChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />

      <ParsePanel
        open={parseTarget !== null}
        sentence={parseTarget?.text ?? ''}
        onClose={() => setParseTarget(null)}
      />

      {selection && article && (
        <WordPopover
          key={`${selection.sentenceId}:${selection.word}`}
          selection={selection}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  )
}
