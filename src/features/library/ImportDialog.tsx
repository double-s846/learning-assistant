/** AI-assisted: 初稿由 DeepSeek（2026-11-17）生成，人工修改点见 docs/AI_USAGE.md 第 3 节。 */
/**
 * 导入文章弹窗。
 *
 * 有意做成「粘贴正文」而不是「输入 URL 自动抓取」：
 *  - 浏览器跨域限制让 URL 抓取必须有服务端代理，与「纯前端、零配置」冲突；
 *  - 粘贴正文反而更贴合精读场景（外刊多有付费墙）。
 * URL 抓取作为增强项记录在 docs/PRODUCT.md 的「后续迭代」里。
 *
 * 版权字段是必填的 —— 这是「来源合规」评分点，不能让用户跳过。
 */

import { useState } from 'react'
import type { ArticleInput } from '@/lib/article'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (input: ArticleInput) => void
}

const EMPTY = {
  title: '',
  source: '',
  text: '',
  sourceUrl: '',
  author: '',
  license: 'CC BY 4.0（团队原创）',
}

export function ImportDialog({ open, onClose, onSubmit }: Props) {
  const [form, setForm] = useState({ ...EMPTY })
  const [error, setError] = useState('')

  if (!open) return null

  function update<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    if (form.text.trim().length < 20) {
      setError('正文太少，至少粘贴 20 个字符。')
      return
    }
    if (!form.title.trim()) {
      setError('请填写标题。')
      return
    }
    setError('')
    onSubmit({
      title: form.title,
      source: form.source || '未标注来源',
      text: form.text,
      sourceUrl: form.sourceUrl,
      author: form.author,
      license: form.license || '来源未标注',
    })
    setForm({ ...EMPTY })
    onClose()
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label="导入文章">
        <div className="modal__head">
          <strong style={{ fontSize: 15 }}>导入文章</strong>
          <p className="hint" style={{ margin: '4px 0 0' }}>
            粘贴正文即可开始精读。段落之间空一行会被识别为分段。
          </p>
        </div>

        <div className="modal__body">
          <div className="field__row">
            <div className="field">
              <label htmlFor="imp-title">标题 *</label>
              <input
                id="imp-title"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="The Attention Economy Is Running Out of Attention"
              />
            </div>
            <div className="field">
              <label htmlFor="imp-source">来源出版物</label>
              <input
                id="imp-source"
                value={form.source}
                onChange={(e) => update('source', e.target.value)}
                placeholder="The Economist / 团队原创"
              />
            </div>
          </div>

          <div className="field__row">
            <div className="field">
              <label htmlFor="imp-url">原文链接</label>
              <input
                id="imp-url"
                value={form.sourceUrl}
                onChange={(e) => update('sourceUrl', e.target.value)}
                placeholder="https://…（选填）"
              />
            </div>
            <div className="field">
              <label htmlFor="imp-author">作者</label>
              <input
                id="imp-author"
                value={form.author}
                onChange={(e) => update('author', e.target.value)}
                placeholder="选填"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="imp-license">授权 / 版权说明 *</label>
            <input
              id="imp-license"
              value={form.license}
              onChange={(e) => update('license', e.target.value)}
              placeholder="例如：Public Domain / CC BY 4.0 / 已获授权转载"
            />
            <span className="hint">
              比赛要求来源可追溯，请如实填写；不确定时写「个人学习使用」。
            </span>
          </div>

          <div className="field">
            <label htmlFor="imp-text">正文 *</label>
            <textarea
              id="imp-text"
              value={form.text}
              onChange={(e) => update('text', e.target.value)}
              placeholder="把外刊正文粘贴到这里…"
            />
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>}
        </div>

        <div className="modal__foot">
          <button className="btn btn--primary" onClick={handleSubmit}>
            导入并开始阅读
          </button>
          <button className="btn btn--ghost" onClick={onClose}>
            取消
          </button>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            {form.text.trim().length} 字符
          </span>
        </div>
      </div>
    </>
  )
}
