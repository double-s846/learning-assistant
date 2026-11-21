import { useEffect, useState } from 'react'
import type { ReviewGrade, Settings, VocabEntry } from '@/types'
import { vocabStore } from '@/lib/storage'
import {
  addedCountByDay,
  buildReviewQueue,
  countMastered,
  dayKey,
  GRADE_LABEL,
  reviewCountByDay,
  reviewEntry,
} from '@/lib/srs'
import { CalendarHeatmap } from './CalendarHeatmap'

interface Props {
  entries: VocabEntry[]
  settings: Settings
  onClose: () => void
}

const GRADES: ReviewGrade[] = ['again', 'good', 'easy']

export function ReviewPanel({ entries, settings, onClose }: Props) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set())
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const dueEntries = buildReviewQueue(entries)
  const queue = dueEntries.filter((entry) => !completedIds.has(entry.id))
  const current = queue[0]
  const today = dayKey(new Date())
  const reviewedToday = reviewCountByDay(entries).get(today) ?? 0
  const addedToday = addedCountByDay(entries).get(today) ?? 0
  const goal = Math.max(1, settings.dailyGoal)
  const goalPercent = Math.min(100, Math.round((addedToday / goal) * 100))

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function gradeCurrent(grade: ReviewGrade) {
    if (!current) return
    vocabStore.upsert(reviewEntry(current, grade))
    setCompletedIds((previous) => new Set(previous).add(current.id))
    setRevealedId(null)
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <section className="review-panel" role="dialog" aria-modal="true" aria-label="复习与日历">
        <header className="review-panel__head">
          <div>
            <h2>复习与日历</h2>
            <span className="hint">复习历史保存在本地</span>
          </div>
          <button className="btn btn--ghost" onClick={onClose} aria-label="关闭复习面板">
            关闭
          </button>
        </header>

        <div className="review-panel__body">
          <section className="review-session" aria-label="今日复习">
            <div className="review-stats">
              <div className="review-stat">
                <span>今日待复习</span>
                <strong>{dueEntries.length}</strong>
              </div>
              <div className="review-stat">
                <span>已掌握</span>
                <strong>{countMastered(entries)}</strong>
              </div>
              <div className="review-stat review-stat--goal">
                <span>今日新词目标</span>
                <strong>{addedToday}<small> / {settings.dailyGoal}</small></strong>
                <div
                  className="review-stat__progress"
                  role="progressbar"
                  aria-label="今日新词目标完成度"
                  aria-valuemin={0}
                  aria-valuemax={settings.dailyGoal}
                  aria-valuenow={Math.min(addedToday, settings.dailyGoal)}
                >
                  <span style={{ width: `${goalPercent}%` }} />
                </div>
              </div>
            </div>

            {current ? (
              <>
                <div className="review-session__meta">
                  <span>本轮剩余 {queue.length} 张</span>
                  <span>今日已复习 {reviewedToday} 次</span>
                </div>
                <button
                  className={`review-card${revealedId === current.id ? ' review-card--revealed' : ''}`}
                  onClick={() => setRevealedId(current.id)}
                  aria-label={revealedId === current.id ? `${current.word} 的释义` : `翻开 ${current.word} 的释义`}
                >
                  {revealedId === current.id ? (
                    <span className="review-card__back">
                      <strong>{current.word}</strong>
                      <span className="review-card__gloss">{current.glossZh}</span>
                      {current.glossEn && <span className="review-card__english">{current.glossEn}</span>}
                      <span className="review-card__context">“{current.context.sentence}”</span>
                    </span>
                  ) : (
                    <span className="review-card__front">
                      <small>先回想释义</small>
                      <strong>{current.word}</strong>
                    </span>
                  )}
                </button>

                <div className="review-grades" role="group" aria-label="为这张卡评分">
                  {GRADES.map((grade) => (
                    <button
                      key={grade}
                      className={`btn review-grade review-grade--${grade}`}
                      disabled={revealedId !== current.id}
                      onClick={() => gradeCurrent(grade)}
                    >
                      {GRADE_LABEL[grade]}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="review-done" role="status">
                <span className="review-done__mark" aria-hidden="true">✓</span>
                {dueEntries.length === 0 ? (
                  <>
                    <h3>今日完成，明天再来</h3>
                    <p>本轮复习了 {completedIds.size} 张卡，所有到期卡片都已安排好下一次复习。</p>
                  </>
                ) : (
                  <>
                    <h3>本轮复习完成</h3>
                    <p>
                      本轮复习了 {completedIds.size} 张卡，还有 {dueEntries.length} 张仍待复习。重新打开面板即可继续。
                    </p>
                  </>
                )}
              </div>
            )}
          </section>

          <CalendarHeatmap entries={entries} />
        </div>
      </section>
    </>
  )
}
