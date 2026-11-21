/**
 * 长句解析面板 —— 模块 D 的界面。
 *
 * 逻辑全部在 `src/lib/clause.ts`（离线规则层，可单测），这里只负责呈现：
 *   · 原句按成分上色（从句 / 修饰语两种底色）
 *   · 主干单独展示 —— 这是「先读主干再看修饰」的阅读方法本身
 *   · 每个成分一句话中文讲解
 *   · 解析来源与局限如实标注（score 里"AI 使用透明化"的一部分）
 */

import { useMemo } from 'react'
import type { ClauseSegment, SentenceParse } from '@/types'
import { analyzeSentence } from '@/lib/clause'

interface Props {
  open: boolean
  sentenceId: string
  sentence: string
  onClose: () => void
}

const ROLE_LABEL: Record<string, string> = {
  main: '主干',
  subject: '主语',
  predicate: '谓语',
  object: '宾语',
  attributive: '定语',
  adverbial: '状语',
  'object-clause': '宾语从句',
  'attributive-clause': '定语从句',
  'adverbial-clause': '状语从句',
  'subject-clause': '主语从句',
  appositive: '同位语从句',
  parenthesis: '插入语',
  unknown: '未识别',
}

/** 把句子拆成「普通文本 + 已标注成分」的交替序列，用于上色 */
function buildPieces(text: string, segments: ClauseSegment[]) {
  const pieces: Array<{ text: string; segment?: ClauseSegment }> = []
  let cursor = 0

  for (const segment of [...segments].sort((a, b) => a.start - b.start)) {
    if (segment.start > cursor) {
      pieces.push({ text: text.slice(cursor, segment.start) })
    }
    pieces.push({ text: text.slice(segment.start, segment.end), segment })
    cursor = segment.end
  }
  if (cursor < text.length) pieces.push({ text: text.slice(cursor) })

  return pieces
}

export function ParsePanel({ open, sentenceId, sentence, onClose }: Props) {
  // 解析是纯函数且很便宜（几毫秒），用 useMemo 缓存即可，不需要异步与 loading
  const parse = useMemo<SentenceParse>(
    () => analyzeSentence(sentence, { sentenceId }),
    [sentence, sentenceId],
  )

  if (!open) return null

  const pieces = buildPieces(sentence, parse.segments)
  const clauseCount = parse.segments.filter((s) => s.kind === 'clause').length
  const degraded = parse.segments.length === 0

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label="长句解析">
        <div className="modal__head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 15 }}>长句解析</strong>
            <span className="tag">{parse.source === 'llm' ? '大模型增强' : '离线规则分析'}</span>
            <span className="tag">识别到 {clauseCount} 个从句</span>
            {degraded && <span className="tag" style={{ color: 'var(--danger)' }}>未能切分</span>}
          </div>

          <p className="sentence-view">
            {pieces.map((piece, i) =>
              piece.segment ? (
                <mark
                  key={i}
                  className="clause"
                  data-kind={piece.segment.kind}
                  data-role={piece.segment.role}
                  title={piece.segment.noteZh}
                >
                  {piece.text}
                </mark>
              ) : (
                <span key={i}>{piece.text}</span>
              ),
            )}
          </p>

          <div className="legend">
            <span>
              <i className="legend__dot" data-kind="clause" /> 从句
            </span>
            <span>
              <i className="legend__dot" data-kind="modifier" /> 修饰语
            </span>
            <span className="hint">悬停可看讲解</span>
          </div>
        </div>

        <div className="modal__body">
          <section>
            <h3 className="parse__h">主干（先读这个）</h3>
            <p className="parse__backbone">{parse.backbone}</p>
            {degraded && (
              <p className="hint" style={{ margin: '4px 0 0', color: 'var(--danger)' }}>
                规则层没能可靠切分这个句子，上面只是整句近似，**不是**真实主干。
              </p>
            )}
          </section>

          <section>
            <h3 className="parse__h">成分拆解</h3>
            {parse.segments.length === 0 && (
              <p className="hint">未识别到从句或介词短语，可能是简单句。</p>
            )}
            <ul className="parse__list">
              {parse.segments.map((segment, i) => (
                <li key={i} className="parse__item">
                  <div className="parse__item-head">
                    <span className="tag">{ROLE_LABEL[segment.role] ?? segment.role}</span>
                    <code className="parse__snippet">{segment.text}</code>
                  </div>
                  <p className="parse__note">{segment.noteZh}</p>
                </li>
              ))}
            </ul>
          </section>

          {parse.tips && parse.tips.length > 0 && (
            <section>
              <h3 className="parse__h">阅读提示</h3>
              <ul className="parse__list">
                {parse.tips.map((tip, i) => (
                  <li key={i} className="parse__note">
                    · {tip}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="hint" style={{ margin: 0 }}>
            本解析由内置规则完成，不联网、不调用大模型；遇到省略 that 的接触从句可能识别不出，
            此时宁可显示「未能切分」也不编造结构。规则说明见 docs/ARCHITECTURE.md。
          </p>
        </div>

        <div className="modal__foot">
          <button className="btn" onClick={onClose}>
            关闭
          </button>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            句子编号 {sentenceId || '—'}
          </span>
        </div>
      </div>
    </>
  )
}
