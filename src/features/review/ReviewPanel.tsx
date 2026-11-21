/**
 * 复习面板 —— 【模块 C】的接入点（当前为可运行的占位实现，交给 JiZhen Gong 接手）
 * ============================================================================
 *
 *  交接说明
 *  ---------------------------------------------------------------------------
 *  这个文件已经接好"顶栏按钮 → 打开面板 → 拿到全部生词"的链路，
 *  你要做的是把下面的占位内容换成真正的复习队列与日历，其余不用动 `App.tsx`。
 *
 *  可以白拿的算法（`src/lib/srs.ts` 已实现并有 9 个单测）：
 *    buildReviewQueue(vocab)      今日待复习队列（已按到期时间排序）
 *    reviewEntry(entry, grade)    应用一次「没记住 / 记得 / 很简单」，返回新的生词卡（纯函数）
 *    monthGrid(year, month)       42 格月历（含前后补齐）
 *    reviewCountByDay(vocab)      每天复习次数，用于热力图上色
 *    addedCountByDay(vocab)       每天新增生词数
 *    dayKey(date)                 本地时区的 YYYY-MM-DD（**别自己写**）
 *    countMastered(vocab)         已掌握（盒子 5）数量
 *    GRADE_LABEL                  三档评分的中文名
 *
 *  数据写回：`vocabStore.upsert(reviewEntry(entry, grade))`，
 *  写完通过 `useVocab()` 订阅自动刷新界面，不需要手动 setState。
 *
 *  ⚠️ 三个容易做错的地方（README 里也写了）
 *   1. 日期只用 srs.ts 的函数，别用 toISOString().slice(0,10)（东八区凌晨会算错天）；
 *   2. 不要把 reviews 历史删掉（日历与记忆曲线都依赖它）；
 *   3. 不要改 `Reader.tsx`。
 * ============================================================================
 */

import type { VocabEntry } from '@/types'
import { buildReviewQueue, countMastered } from '@/lib/srs'

interface Props {
  open: boolean
  vocab: VocabEntry[]
  dailyGoal: number
  onClose: () => void
}

export function ReviewPanel({ open, vocab, dailyGoal, onClose }: Props) {
  if (!open) return null

  // 队列已经算好，直接可以用；下面是占位展示，替换成你的实现即可
  const queue = buildReviewQueue(vocab)
  const mastered = countMastered(vocab)

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <section className="panel" role="dialog" aria-modal="true" aria-label="复习">
        <div className="panel__head">
          <span className="panel__title">复习</span>
          <span className="tag">{queue.length} 张待复习</span>
          <button className="btn btn--ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="panel__body">
          <div className="card">
            <div className="card__word">
              <b>今日状态</b>
            </div>
            <p className="card__gloss">
              待复习 {queue.length} 张 · 已掌握 {mastered} 张 · 每日目标 {dailyGoal} 词
            </p>
            <p className="card__ctx">
              数据已经算好了（`buildReviewQueue` / `countMastered`），把这个占位换成真正的卡片列表即可。
            </p>
          </div>

          <div className="card">
            <div className="card__word">
              <b>模块 C 交付清单</b>
            </div>
            <ul className="card__gloss" style={{ paddingLeft: 18, margin: '6px 0 0' }}>
              <li>复习队列卡片（正面只显示单词，点一下翻面看释义与原句）</li>
              <li>「没记住 / 记得 / 很简单」三档评分 → `vocabStore.upsert(reviewEntry(...))`</li>
              <li>队列走完的完成态</li>
              <li>日历热力图（`monthGrid` + `reviewCountByDay`）</li>
              <li>生词记忆曲线（用 `reviews[].fromBox/toBox` 画）</li>
              <li>每日目标完成度</li>
            </ul>
            <p className="card__ctx">详见 src/features/review/README.md</p>
          </div>
        </div>

        <div className="panel__foot">
          <span className="hint">模块 C · JiZhen Gong · 分支 dev/jz-Gong10-c</span>
        </div>
      </section>
    </>
  )
}
