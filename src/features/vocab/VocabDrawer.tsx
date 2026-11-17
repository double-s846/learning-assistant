/**
 * 生词抽屉（当前为「起点实现」）。
 *
 * ⚠️ 交接说明：这个文件是给【模块 B / C】同学继续扩展的基线，已具备：
 *   · 列表 + 释义 + 出处原句 + 来源标签 + 删除
 *   · 删除后自动同步阅读区下划线（走 storage 订阅，不需要手动刷新）
 * 待扩展（见 docs/TEAM.md 分工表）：
 *   · 复习队列与三档评分（调用 lib/srs.ts 的 reviewEntry）
 *   · 日历热力图（srs.ts 已提供 monthGrid / reviewCountByDay）
 *   · 搜索、按文章筛选、导出 CSV
 */

import type { VocabEntry } from '@/types'
import { DICT_SOURCE_LABEL } from '@/lib/dict'
import { vocabStore } from '@/lib/storage'

interface Props {
  open: boolean
  entries: VocabEntry[]
  onClose: () => void
  onOpenArticle: (articleId: string) => void
}

export function VocabDrawer({ open, entries, onClose, onOpenArticle }: Props) {
  if (!open) return null

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <section className="panel" role="dialog" aria-modal="true" aria-label="生词本">
        <div className="panel__head">
          <span className="panel__title">生词本</span>
          <span className="tag">{entries.length} 张卡</span>
          <button className="btn btn--ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="panel__body">
          {entries.length === 0 && (
            <div className="side__empty" style={{ padding: '24px 4px' }}>
              还没有生词。在阅读区点任意一个英文单词，就能看到释义并加入生词本。
            </div>
          )}

          {entries.map((entry) => (
            <article key={entry.id} className="card">
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
            </article>
          ))}
        </div>

        <div className="panel__foot">
          <span className="hint">
            复习队列与日历视图由【模块 C】实现 · 见 docs/TEAM.md
          </span>
        </div>
      </section>
    </>
  )
}
