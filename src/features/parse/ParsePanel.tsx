/**
 * 长句解析面板 —— 【模块 D】的接入点（当前为可运行的占位实现）
 * ============================================================================
 *
 *  交接说明（给负责模块 D 的同学）
 *  ---------------------------------------------------------------------------
 *  这个组件已经接好了「点击句子 → 拿到 sentenceId + 句子原文」的链路，
 *  你要做的是把 `analyzeSentence()` 换成真正的解析逻辑，其余 UI 可以照用。
 *
 *  契约见 src/types.ts 的 `SentenceParse` / `ClauseSegment`：
 *    · segments[].start/end 是**句子文本内的字符偏移**，用它在句子上画彩色下划线；
 *    · role 决定颜色（主干 / 从句 / 修饰），noteZh 是给学生看的一句话讲解；
 *    · source 为 'rule'（离线规则）或 'llm'（大模型增强），必须如实填写 ——
 *      这是比赛「AI 使用透明化」的硬要求。
 *
 *  建议实现路线（由易到难，先保证离线可用）：
 *    1. 规则层：连词表（that/which/who/because/although/while/if…）切分从句；
 *       屈折后缀 + 介词短语（in the … / of the …）识别修饰语；
 *    2. 主干抽取：去掉从句与介词短语后剩下的主谓宾；
 *    3. 中文讲解：模板化生成（"that 引导宾语从句，作 warns 的宾语"）；
 *    4. 可选增强：配置 VITE_LLM_* 后调用大模型补充整句翻译，失败必须静默回落到规则层。
 *
 *  ⚠️ 不要为了「看起来聪明」在规则层失败时硬造解析结果，宁可显示「未能解析」。
 * ============================================================================
 */

import { useMemo } from 'react'
import type { SentenceParse } from '@/types'
import { createId, ID_PREFIX } from '@/lib/id'

interface Props {
  open: boolean
  sentence: string
  onClose: () => void
}

/**
 * TODO(模块 D)：替换为真实解析。
 * 现在返回一个诚实的占位结果：只标出整句为主干，不编造从句结构。
 */
function analyzeSentence(sentence: string): SentenceParse {
  return {
    sentenceId: createId(ID_PREFIX.parse),
    text: sentence,
    source: 'rule',
    backbone: sentence,
    depth: 0,
    segments: [
      {
        start: 0,
        end: sentence.length,
        text: sentence,
        role: 'main',
        noteZh: '（解析引擎待接入）当前仅识别整句为主干。',
      },
    ],
    tips: ['长句解析模块尚未实现，此处为契约占位。'],
  }
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
  appositive: '同位语',
  parenthesis: '插入语',
  unknown: '未识别',
}

export function ParsePanel({ open, sentence, onClose }: Props) {
  // 解析结果由「句子文本」派生，不需要 state：
  // 将来接入 LLM 时这里换成 useState + async 查询即可（注意保持离线可用）。
  const parse = useMemo(() => (open ? analyzeSentence(sentence) : null), [open, sentence])

  if (!open) return null

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label="长句解析">
        <div className="modal__head">
          <strong style={{ fontSize: 15 }}>长句解析</strong>
          <span className="tag" style={{ marginLeft: 8 }}>
            {parse?.source === 'llm' ? '大模型增强' : '离线规则'}
          </span>
          <p
            className="hint"
            style={{
              margin: '8px 0 0',
              fontFamily: 'var(--font-serif)',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--ink)',
            }}
          >
            {sentence}
          </p>
        </div>

        <div className="modal__body">
          <div>
            <span className="hint">主干</span>
            <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-serif)' }}>
              {parse?.backbone}
            </p>
          </div>

          <div>
            <span className="hint">成分</span>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
              {parse?.segments.map((segment, i) => (
                <li key={i}>
                  <span className="tag">{ROLE_LABEL[segment.role] ?? segment.role}</span>{' '}
                  {segment.noteZh}
                </li>
              ))}
            </ul>
          </div>

          <p className="hint" style={{ margin: 0 }}>
            模块 D 待实现 · 见 docs/TEAM.md 与 src/features/parse/README.md
          </p>
        </div>

        <div className="modal__foot">
          <button className="btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </>
  )
}
