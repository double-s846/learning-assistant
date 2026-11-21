/** AI-assisted: 初稿由 DeepSeek（2026-11-17）生成，人工修改点见 docs/AI_USAGE.md 第 3 节。 */
/**
 * 阅读区 —— 全项目的视觉与交互核心。
 * ============================================================================
 *
 *  渲染策略：段落 → 句子 → 单词，三层都是 inline span，
 *  因此「点词」「句子高亮」「生词下划线」「长句成分标注」都在同一份 DOM 上叠加，
 *  不需要坐标换算，不会出现高亮错位。
 *
 *  【重要】装饰层插槽（decorations）
 *  ---------------------------------------------------------------------------
 *  这个文件是三个模块的交汇点：生词下划线（模块 B）、长句高亮（模块 D）、
 *  朗读当前句（模块 E）。如果每个人都直接改这里，JSX 嵌套冲突基本无法手工合并。
 *
 *  所以 Reader **只负责渲染正文**，所有"在这一句/这个词上加点什么"的需求，
 *  一律通过 `decorations` 传进来：
 *
 *      <Reader
 *        article={article}
 *        settings={settings}
 *        decorations={{
 *          wordClassName: (word) => vocabLemmas.has(word) ? 'w--saved' : undefined,
 *          sentenceClassName: (s) => s.id === activeId ? 'sent--active' : undefined,
 *          renderSentenceOverlay: (s) => <ClauseMarks sentence={s} />,   // 模块 D
 *          renderParagraphExtra: (p) => <SpanTime paragraph={p} />,      // 模块 E
 *        }}
 *      />
 *
 *  ⚠️ 组员请注意：**不要修改本文件**。需要新的插槽请在群里说，
 *     由负责公共层的成员统一加（避免三个分支同时改同一段 JSX）。
 *     现有插槽不够用的典型场景：「词级浮层」「句级右键菜单」「按段落折叠」→ 提出来加。
 * ============================================================================
 */

import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import type {
  Article,
  Paragraph,
  ReadingMode,
  Sentence,
  Settings,
  WordHit,
} from '@/types'
import { getSentencesByParagraph } from '@/lib/article'
import { tokenizeWords } from '@/lib/tokenize'
import { PdfDocumentProvider, PdfFigure, PdfPageFigures } from './PdfPageFigure'

/**
 * 装饰层插槽集合。全部可选，不传就是"干净阅读"。
 *
 * 设计原则：**只给 class 名和额外的 ReactNode，不给 DOM 操作能力**。
 * 这样任何模块都无法破坏正文结构，也就不会互相踩。
 */
export interface ReaderDecorations {
  /** 句子级 class（TTS 当前朗读句、长句解析焦点句） */
  sentenceClassName?: (sentence: Sentence) => string | undefined
  /** 单词级 class（已存生词下划线、词频标记等）。word 为原始词形，未小写化 */
  wordClassName?: (word: string, sentence: Sentence) => string | undefined
  /** 句子内部的额外渲染（长句成分下划线、朗读进度点）。渲染在句子文本之前 */
  renderSentenceOverlay?: (sentence: Sentence) => ReactNode
  /** 段落尾部追加内容（阅读时长、笔记入口等） */
  renderParagraphExtra?: (paragraph: Paragraph) => ReactNode
}

interface Props {
  article: Article
  settings: Settings
  /** 装饰层插槽。不传则只渲染纯正文 */
  decorations?: ReaderDecorations
  /** 已读段落 id 列表。不传则不显示段落勾选按钮 */
  readParagraphIds?: string[]
  /** 句子是否可点（学习模式下为 true，流畅模式下应传 false 以免误触） */
  sentenceClickable?: boolean
  onToggleParagraph?: (paragraphId: string) => void
  onWordClick?: (hit: WordHit, event: ReactMouseEvent<HTMLSpanElement>) => void
  onSentenceClick?: (sentence: Sentence) => void
}

/** 把多个可能为空的 class 合并，避免出现 "w undefined" 这种脏字符串 */
function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(' ')
}

export function Reader({
  article,
  settings,
  decorations,
  readParagraphIds,
  sentenceClickable = true,
  onToggleParagraph,
  onWordClick,
  onSentenceClick,
}: Props) {
  const byParagraph = getSentencesByParagraph(article)
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
  const canMarkRead = Array.isArray(readParagraphIds) && typeof onToggleParagraph === 'function'

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
          const isRead = readParagraphIds?.includes(paragraph.id) ?? false

          return (
            <p
              key={paragraph.id}
              className={cx('para', isRead && 'para--read')}
              style={{
                fontSize: settings.fontSize,
                lineHeight: settings.lineHeight,
              }}
            >
              {canMarkRead && (
                <button
                  className="para__check"
                  aria-pressed={isRead}
                  aria-label={isRead ? '取消本段已读' : '标记本段已读'}
                  title={isRead ? '取消已读' : '标记本段已读'}
                  onClick={() => onToggleParagraph?.(paragraph.id)}
                >
                  {isRead ? '✓' : ''}
                </button>
              )}

              {sentences.map((sentence) => (
                <span
                  key={sentence.id}
                  data-sentence-id={sentence.id}
                  className={cx('sent', decorations?.sentenceClassName?.(sentence))}
                  onClick={() => {
                    if (!sentenceClickable) return
                    onSentenceClick?.(sentence)
                  }}
                  title={mode === 'study' && sentenceClickable ? '点击句子查看长句解析' : undefined}
                >
                  {decorations?.renderSentenceOverlay?.(sentence)}

                  {tokenizeWords(sentence.text).map((token, i) =>
                    token.isWord ? (
                      <span
                        key={`${sentence.id}-${i}`}
                        className={cx('w', decorations?.wordClassName?.(token.text, sentence))}
                        onClick={(event) => {
                          // 阻止冒泡，避免同时触发整句解析
                          if (!onWordClick) return
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

              {decorations?.renderParagraphExtra?.(paragraph)}
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
