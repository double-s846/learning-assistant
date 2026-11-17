/**
 * 侧边栏：文章库 + 进度概览。
 *
 * 每一篇显示「进度条 + 百分比」，这是赛题要求里
 * 「给出阅读进度与打勾标记」的综合体现：
 * 段落级勾选 → 汇总成文章级百分比 → 侧栏一眼看到读了多少。
 */

import type { Article, ReadingProgress } from '@/types'

interface Props {
  articles: Article[]
  progressList: ReadingProgress[]
  currentId: string | undefined
  vocabCount: number
  dueCount: number
  onSelect: (id: string) => void
  onImport: () => void
  onOpenVocab: () => void
}

export function Sidebar({
  articles,
  progressList,
  currentId,
  vocabCount,
  dueCount,
  onSelect,
  onImport,
  onOpenVocab,
}: Props) {
  return (
    <aside className="side">
      <div className="side__brand">
        <h1>外刊学习助手</h1>
        <p>码力同行 · 开源实践挑战 · 赛道一赛题1</p>
      </div>

      <div className="side__actions">
        <button className="btn btn--primary" style={{ flex: 1 }} onClick={onImport}>
          + 导入文章
        </button>
        <button className="btn" onClick={onOpenVocab} title="打开生词本">
          生词 {vocabCount}
          {dueCount > 0 && <span className="tag">{dueCount} 待复习</span>}
        </button>
      </div>

      <div className="side__label">
        <span>文章库</span>
        <span>{articles.length}</span>
      </div>

      <div className="side__list">
        {articles.length === 0 && (
          <div className="side__empty">
            还没有文章。点上方「导入文章」粘贴一篇外刊正文，或等待示例文章加载。
          </div>
        )}

        {articles.map((article) => {
          const progress = progressList.find((p) => p.articleId === article.id)
          const percent = progress?.percent ?? 0

          return (
            <button
              key={article.id}
              className="art-item"
              aria-current={article.id === currentId}
              onClick={() => onSelect(article.id)}
            >
              <span className="art-item__title">
                {progress?.finished && <span title="已读完">✓</span>}
                {article.title}
              </span>
              <span className="art-item__meta">
                <span>{article.source}</span>
                <span>·</span>
                <span>{article.readingMinutes} 分钟</span>
                <span>·</span>
                <span>{percent}%</span>
              </span>
              <span className="art-item__bar">
                <i style={{ width: `${percent}%` }} />
              </span>
            </button>
          )
        })}
      </div>

      <div className="side__foot">
        <span className="hint">
          数据保存在本机浏览器，无需登录。可在设置里导出备份。
        </span>
      </div>
    </aside>
  )
}
