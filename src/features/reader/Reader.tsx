/** AI-assisted: 初稿由 DeepSeek（2026-11-17）生成，人工修改点见 docs/AI_USAGE.md 第 3 节。 */
/**
 * 阅读区 —— 全项目的视觉与交互核心。
 *
 * 渲染策略：段落 → 句子 → 单词，三层都是 inline span，
 * 因此「点词」「句子高亮」「生词下划线」都在同一份 DOM 上叠加，
 * 不需要坐标换算，不会出现高亮错位。
 *
 * 流畅模式（flow）与学习模式（study）的差别只在这里：
 *   flow：不显示生词下划线、句子不可整句选中，标题简洁；
 *   study：生词带下划线，句子可点（长句解析入口），显示句级标注。
 */

import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Article, Paragraph, ReadingMode, Settings, VocabEntry } from '@/types'
import { getSentencesByParagraph } from '@/lib/article'
import { tokenizeWords } from '@/lib/tokenize'
import type { WordSelection } from '@/features/vocab/WordPopover'
import { PdfDocumentProvider, PdfFigure, PdfPageFigures } from './PdfPageFigure'

interface Props {
  article: Article
  settings: Settings
  vocab: VocabEntry[]
  readParagraphIds: string[]
  onWordClick: (
    selection: Omit<WordSelection, 'x' | 'y'>,
    event: ReactMouseEvent<HTMLSpanElement>,
  ) => void
  onToggleParagraph: (paragraphId: string) => void
  onSentenceClick: (sentenceId: string, sentenceText: string) => void
}

export function Reader({
  article,
  settings,
  vocab,
  readParagraphIds,
  onWordClick,
  onToggleParagraph,
  onSentenceClick,
}: Props) {
  const byParagraph = getSentencesByParagraph(article)
  const savedLemmas = new Set(vocab.map((v) => v.lemma))
  const mode: ReadingMode = settings.mode
  const paragraphsByPage = new Map<number, Paragraph[]>()
  for (const paragraph of article.paragraphs) {
    const page = paragraph.pdfPage ?? 0
    const list = paragraphsByPage.get(page) ?? []
    list.push(paragraph)
    paragraphsByPage.set(page, list)
  }
  const groups = article.pdf
    ? [
        { page: 0, paragraphs: paragraphsByPage.get(0) ?? [] },
        ...Array.from({ length: article.pdf.pageCount }, (_, index) => ({
          page: index + 1,
          paragraphs: paragraphsByPage.get(index + 1) ?? [],
        })),
      ]
    : [{ page: 0, paragraphs: article.paragraphs }]

  return (
    <PdfDocumentProvider key={article.id} fileId={article.pdf?.fileId}>
    <div className="read">
      <div className="read__inner">
        <h1 className="read__title">{article.title}</h1>

        <div className="read__sub">
          <span>{article.source}</span>
          {article.author && <span>· {article.author}</span>}
          <span>· 约 {article.readingMinutes} 分钟</span>
          <span className="tag" title="来源授权说明">
            {article.license}
          </span>
        </div>

        <div className="read__rule" />

        {groups.map((group) => (
          <section key={group.page} className="read__page" aria-label={group.page ? `PDF 第 ${group.page} 页` : undefined}>
          {group.page > 0 && <h2 className="read__page-label">PDF 第 {group.page} 页</h2>}
          {group.paragraphs.map((paragraph) => {
          if (paragraph.pdfFigure) {
            const figure = article.pdf?.figures?.find((item) => item.index === paragraph.pdfFigure)
            return figure ? <PdfFigure key={paragraph.id} figure={figure} /> : null
          }
          const sentences = byParagraph.get(paragraph.id) ?? []
          const isRead = readParagraphIds.includes(paragraph.id)

          return (
            <p
              key={paragraph.id}
              className={`para${isRead ? ' para--read' : ''}`}
              style={{
                fontSize: settings.fontSize,
                lineHeight: settings.lineHeight,
              }}
            >
              <button
                className="para__check"
                aria-pressed={isRead}
                aria-label={isRead ? '取消本段已读' : '标记本段已读'}
                title={isRead ? '取消已读' : '标记本段已读'}
                onClick={() => onToggleParagraph(paragraph.id)}
              >
                {isRead ? '✓' : ''}
              </button>

              {sentences.map((sentence) => (
                <span
                  key={sentence.id}
                  className="sent"
                  onClick={() => onSentenceClick(sentence.id, sentence.text)}
                  title={mode === 'study' ? '点击句子查看长句解析' : undefined}
                >
                  {tokenizeWords(sentence.text).map((token, i) =>
                    token.isWord ? (
                      <span
                        key={`${sentence.id}-${i}`}
                        className={`w${
                          mode === 'study' && savedLemmas.has(token.text.toLowerCase())
                            ? ' w--saved'
                            : ''
                        }`}
                        onClick={(event) => {
                          // 阻止冒泡，避免同时触发整句解析
                          event.stopPropagation()
                          onWordClick(
                            {
                              word: token.text,
                              articleId: article.id,
                              articleTitle: article.title,
                              paragraphId: paragraph.id,
                              sentenceId: sentence.id,
                              sentence: sentence.text,
                            },
                            event,
                          )
                        }}
                      >
                        {token.text}
                      </span>
                    ) : (
                      <span key={`${sentence.id}-t-${i}`}>{token.text}</span>
                    ),
                  )}
                  {sentence.index < sentences.length - 1 ? ' ' : ''}
                </span>
              ))}
            </p>
          )
          })}
          {group.page > 0 && !article.pdf?.figures && <PdfPageFigures pageNumber={group.page} />}
          </section>
        ))}
      </div>
    </div>
    </PdfDocumentProvider>
  )
}
