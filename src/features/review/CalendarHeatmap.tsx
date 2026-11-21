import { useState } from 'react'
import type { VocabEntry } from '@/types'
import { addedCountByDay, dayKey, monthGrid, reviewCountByDay } from '@/lib/srs'

interface Props {
  entries: VocabEntry[]
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function CalendarHeatmap({ entries }: Props) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const cells = monthGrid(month.getFullYear(), month.getMonth())
  const reviewsByDay = reviewCountByDay(entries)
  const addedByDay = addedCountByDay(entries)
  const today = dayKey(new Date())

  const selectedEntries = selectedDay
    ? entries
        .map((entry) => ({
          entry,
          reviews: entry.reviews.filter((review) => dayKey(review.at) === selectedDay).length,
          added: dayKey(entry.createdAt) === selectedDay,
        }))
        .filter((item) => item.reviews > 0 || item.added)
    : []

  function changeMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function selectDate(date: Date) {
    setSelectedDay(dayKey(date))
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
  }

  return (
    <section className="calendar" aria-label="复习日历">
      <div className="calendar__head">
        <div>
          <h3>学习日历</h3>
          <span className="hint">复习次数越多，颜色越深</span>
        </div>
        <div className="calendar__navigation" aria-label="切换月份">
          <button className="btn btn--ghost" onClick={() => changeMonth(-1)} aria-label="上个月">‹</button>
          <strong>{month.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}</strong>
          <button className="btn btn--ghost" onClick={() => changeMonth(1)} aria-label="下个月">›</button>
        </div>
      </div>

      <div className="calendar__grid" role="grid" aria-label={month.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}>
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="calendar__weekday" role="columnheader">{weekday}</span>
        ))}
        {cells.map((date) => {
          const key = dayKey(date)
          const reviewCount = reviewsByDay.get(key) ?? 0
          const addedCount = addedByDay.get(key) ?? 0
          const inMonth = date.getMonth() === month.getMonth()
          const isToday = key === today
          const tooltip = `${key.slice(5)}：复习 ${reviewCount} 张，新增 ${addedCount} 词`
          const intensity = reviewCount === 0 ? 0 : Math.min(0.78, 0.14 + reviewCount * 0.1)

          return (
            <button
              key={key}
              className={`calendar__day${inMonth ? '' : ' calendar__day--outside'}${isToday ? ' calendar__day--today' : ''}`}
              style={{ '--heat': intensity } as React.CSSProperties}
              title={tooltip}
              aria-label={tooltip}
              aria-pressed={selectedDay === key}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => selectDate(date)}
            >
              <span className="calendar__fill" aria-hidden="true" />
              <span className="calendar__number">{date.getDate()}</span>
              {addedCount > 0 && <span className="calendar__added" aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      <div className="calendar__legend" aria-label="日历图例">
        <span><i className="calendar__legend-dot calendar__legend-dot--added" />新增生词</span>
        <span className="calendar__legend-scale">复习少 <i /><i /><i /> 多</span>
      </div>

      <div className="calendar__records" aria-live="polite">
        {selectedDay ? (
          <>
            <div className="calendar__records-head">
              <strong>{selectedDay}</strong>
              <span className="hint">{selectedEntries.length} 张卡片</span>
            </div>
            {selectedEntries.length > 0 ? (
              <ul>
                {selectedEntries.map(({ entry, reviews, added }) => (
                  <li key={entry.id}>
                    <span className="calendar__record-word">{entry.word}</span>
                    <span className="calendar__record-gloss">{entry.glossZh}</span>
                    <span className="calendar__record-tags">
                      {added && <span className="tag">新增</span>}
                      {reviews > 0 && <span className="tag">复习 {reviews} 次</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="calendar__empty">这天没有新增或复习记录。</p>
            )}
          </>
        ) : (
          <p className="calendar__empty">选择一天查看当天的生词和复习记录。</p>
        )}
      </div>
    </section>
  )
}
