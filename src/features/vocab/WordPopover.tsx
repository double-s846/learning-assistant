/** AI-assisted: 初稿由 DeepSeek（2026-11-17）生成，人工修改点见 docs/AI_USAGE.md 第 3 节。 */
/**
 * 查词气泡 —— 阅读区里「学习深度」的第一入口。
 *
 * 交互：点一个词 → 立刻显示本地词表能给的释义（几乎零延迟），
 * 若本地没有则后台请求免费词典并原地更新，不阻塞阅读。
 *
 * 关键设计：释义来源永远显示出来（对应比赛要求的「AI / 外部依赖透明化」），
 * 用户随时知道这条中文是内置词表给的还是网上查的。
 */

import { useEffect, useRef, useState } from 'react'
import type { DictResult, VocabEntry, WordHit } from '@/types'
import { DICT_SOURCE_LABEL, lookup } from '@/lib/dict'
import { createId, ID_PREFIX } from '@/lib/id'
import { vocabStore } from '@/lib/storage'

/**
 * 查词气泡的输入 = 阅读器抛出的 `WordHit` + 屏幕坐标。
 * 上下文部分（文章/段落/句子）由 Reader 提供，这里只补位置信息，
 * 这样 Reader 就不需要依赖本模块 —— 依赖方向保持单向（features → types）。
 */
export type WordSelection = WordHit & {
  /** 点击位置，用于定位气泡 */
  x: number
  y: number
}

interface Props {
  selection: WordSelection
  onClose: () => void
}

export function WordPopover({ selection, onClose }: Props) {
  const [result, setResult] = useState<DictResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [manualGloss, setManualGloss] = useState('')
  const [lookupAttempt, setLookupAttempt] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  // 每次换词重新查。组件由父级用 key 强制重建，因此这里只负责「查」，
  // 不需要在 effect 里手动重置一堆 state（那会触发级联渲染）。
  useEffect(() => {
    let cancelled = false

    lookup(selection.word).then((r) => {
      if (cancelled) return
      setResult(r)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [selection.word, lookupAttempt])

  // 点外面 / Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    // 延后一拍，避免触发这次点击本身又立刻关掉
    const timer = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      clearTimeout(timer)
    }
  }, [onClose])

  function handleSave() {
    if (!result) return
    const gloss = (result.glossZh || manualGloss).trim()
    if (!gloss) return

    const entry: VocabEntry = {
      id: createId(ID_PREFIX.vocab),
      word: result.word,
      lemma: result.lemma,
      phonetic: result.phonetic,
      pos: result.pos,
      glossZh: gloss,
      glossEn: result.glossEn,
      glossSource: result.glossZh ? result.source : 'manual',
      context: {
        articleId: selection.articleId,
        articleTitle: selection.articleTitle,
        paragraphId: selection.paragraphId,
        sentenceId: selection.sentenceId,
        sentence: selection.sentence,
      },
      createdAt: new Date().toISOString(),
      box: 0,
      dueAt: new Date().toISOString(),
      reviews: [],
    }

    vocabStore.upsert(entry)
    setSaved(true)
    setTimeout(onClose, 420)
  }

  function retryLookup() {
    setManualGloss('')
    setResult(null)
    setLoading(true)
    setLookupAttempt((attempt) => attempt + 1)
  }

  // 气泡定位：优先放上方，空间不够就放下方
  const top = selection.y > 320 ? selection.y - 20 : selection.y + 28
  const style = {
    left: Math.min(Math.max(12, selection.x - 160), window.innerWidth - 332),
    top: Math.max(12, Math.min(top, window.innerHeight - 300)),
    transform: selection.y > 320 ? 'translateY(-100%)' : undefined,
  }

  const needsManual = result !== null && !result.glossZh

  return (
    <div className="pop" ref={boxRef} style={style} role="dialog" aria-label="查词">
      <div className="pop__head">
        <span className="pop__word">{selection.word}</span>
        {result?.phonetic && <span className="pop__phonetic">{result.phonetic}</span>}
        {result?.pos && <span className="tag">{result.pos}</span>}
        {result?.lemma && result.lemma !== result.word && (
          <span className="tag">原形 {result.lemma}</span>
        )}
      </div>

      {loading && <p className="pop__gloss hint">查词中…</p>}

      {!loading && result && (
        <>
          {result.glossZh ? (
            <p className="pop__gloss">{result.glossZh}</p>
          ) : (
            <p className="pop__gloss pop__gloss--empty">
              {result.glossEn
                ? '已找到英文释义，但自动翻译暂不可用。请补充中文释义后加入生词本。'
                : '暂未查到释义，可以重试联网查询或手动填写。'}
            </p>
          )}

          {result.glossEn && <p className="pop__en">{result.glossEn}</p>}

          {needsManual && (
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="manual-gloss">手动填写中文释义</label>
              <input
                id="manual-gloss"
                value={manualGloss}
                onChange={(e) => setManualGloss(e.target.value)}
                placeholder="例如：v. 使恶化；退化"
                autoFocus
              />
            </div>
          )}
        </>
      )}

      <p className="pop__ctx">{selection.sentence}</p>

      <div className="pop__foot">
        <button
          className="btn btn--primary"
          onClick={handleSave}
          disabled={saved || loading || (needsManual && manualGloss.trim().length === 0)}
        >
          {saved ? '已加入生词本 ✓' : '加入生词本'}
        </button>
        {needsManual && (
          <button className="btn btn--ghost" onClick={retryLookup} disabled={loading}>
            重试查词和翻译
          </button>
        )}
        <button className="btn btn--ghost" onClick={onClose}>
          关闭
        </button>
      </div>

      {result && (
        <div className="pop__src">释义来源：{DICT_SOURCE_LABEL[result.source]}</div>
      )}
    </div>
  )
}
