/** AI-assisted: 初稿由 DeepSeek（2026-11-17）生成，人工修改点见 docs/AI_USAGE.md 第 3 节。 */
/**
 * 导入文章弹窗。
 *
 * 支持粘贴正文和本地 PDF 文本提取，不抓取外部 URL：
 *  - 浏览器跨域限制让 URL 抓取必须有服务端代理，与「纯前端、零配置」冲突；
 *  - 粘贴正文反而更贴合精读场景（外刊多有付费墙）。
 * URL 抓取作为增强项记录在 docs/PRODUCT.md 的「后续迭代」里。
 *
 * 版权字段是必填的 —— 这是「来源合规」评分点，不能让用户跳过。
 */

import { useEffect, useRef, useState } from 'react'
import type { ArticleInput } from '@/lib/article'
import { createId } from '@/lib/id'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (input: ArticleInput) => void | Promise<void>
}

const EMPTY = {
  title: '',
  source: '',
  text: '',
  sourceUrl: '',
  author: '',
  license: '',
}

export function ImportDialog({ open, onClose, onSubmit }: Props) {
  return open ? <ImportForm onClose={onClose} onSubmit={onSubmit} /> : null
}

function ImportForm({ onClose, onSubmit }: Omit<Props, 'open'>) {
  const [form, setForm] = useState({ ...EMPTY })
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'text' | 'pdf'>('text')
  const [extracting, setExtracting] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [pdfSummary, setPdfSummary] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfPageCount, setPdfPageCount] = useState(0)
  const [keepPdfPages, setKeepPdfPages] = useState(true)
  const [saving, setSaving] = useState(false)
  const extractionRef = useRef<AbortController | null>(null)

  useEffect(() => () => extractionRef.current?.abort(), [])

  function update<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (extracting || saving) return
    if (form.text.replace(/^【PDF 第 \d+ 页】\s*$/gm, '').trim().length < 20 && !(pdfFile && keepPdfPages)) {
      setError('正文太少，至少需要 20 个字符。请粘贴正文或从 PDF 提取文字。')
      return
    }
    if (!form.title.trim()) {
      setError('请填写标题。')
      return
    }
    if (!form.license.trim()) {
      setError('请填写授权 / 版权说明；个人学习资料可填写「个人学习使用」。')
      return
    }
    setError('')
    setSaving(true)
    try {
      await onSubmit({
        title: form.title,
        source: form.source || '未标注来源',
        text: form.text,
        sourceUrl: form.sourceUrl,
        author: form.author,
        license: form.license,
        pdfPageCount: pdfPageCount || undefined,
        ...(pdfFile && keepPdfPages ? {
          pdf: { fileId: createId('pdf'), pageCount: pdfPageCount },
          pdfFile,
        } : {}),
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '文章保存失败，请重试。')
      return
    } finally {
      setSaving(false)
    }
    setForm({ ...EMPTY })
    onClose()
  }

  async function handlePdf(file: File) {
    extractionRef.current?.abort()
    const controller = new AbortController()
    extractionRef.current = controller
    setExtracting(true)
    setError('')
    setPdfSummary('')
    setProgress({ completed: 0, total: 0 })

    try {
      // Load PDF.js and its local worker only when a PDF is selected.
      const { extractPdf } = await import('./pdf')
      controller.signal.throwIfAborted()
      const result = await extractPdf(file, {
        signal: controller.signal,
        onProgress: (completed, total) => {
          if (!controller.signal.aborted) setProgress({ completed, total })
        },
      })
      if (controller.signal.aborted) return
      setPdfFile(file)
      setPdfPageCount(result.pageCount)
      setForm((previous) => ({
        ...previous,
        title: previous.title.trim() || result.title,
        author: previous.author.trim() || result.author,
        source: previous.source.trim() || file.name,
        text: result.text,
      }))
      const skipped = result.emptyPages.length
        ? `其中 ${result.emptyPages.length} 页没有可提取文字，保留原页后仍可查看图片，点词需先做 OCR。`
        : ''
      setPdfSummary(`已提取「${file.name}」，共 ${result.pageCount} 页。${skipped}请检查下方正文，保留页码标记即可将原页图文放在对应文字之后。`)
    } catch (cause) {
      if (controller.signal.aborted) return
      setError(cause instanceof Error ? cause.message : 'PDF 提取失败，请重新选择文件或粘贴正文。')
    } finally {
      if (!controller.signal.aborted) setExtracting(false)
    }
  }

  function stopExtraction() {
    extractionRef.current?.abort()
    setExtracting(false)
    setPdfSummary('已停止提取，可以重新选择 PDF 或粘贴正文。')
  }

  return (
    <>
      <div className="scrim" onClick={() => { if (!saving) onClose() }} />
      <div className="modal" role="dialog" aria-modal="true" aria-label="导入文章">
        <div className="modal__head">
          <strong style={{ fontSize: 15 }}>导入文章</strong>
          <p className="hint" style={{ margin: '4px 0 0' }}>
            粘贴正文或选择 PDF 论文，确认正文后即可开始精读。
          </p>
        </div>

        <div className="modal__body">
          <div className="seg import-modes" role="group" aria-label="导入方式">
            <button aria-pressed={mode === 'text'} disabled={extracting || saving} onClick={() => setMode('text')}>
              粘贴正文
            </button>
            <button aria-pressed={mode === 'pdf'} disabled={extracting || saving} onClick={() => setMode('pdf')}>
              上传 PDF
            </button>
          </div>

          {mode === 'pdf' && (
            <div className="import-pdf">
              <div className="field">
                <label htmlFor="imp-pdf">选择 PDF 文件</label>
                <input
                  id="imp-pdf"
                  type="file"
                  accept=".pdf,application/pdf"
                  disabled={extracting || saving}
                  aria-describedby="imp-pdf-help"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    event.currentTarget.value = ''
                    if (file) void handlePdf(file)
                  }}
                />
                <span className="hint" id="imp-pdf-help">
                  在本机处理，PDF 不会上传。支持 30 MB、300 页以内的 PDF。
                  保留原页可查看图片、矢量图表与公式；扫描件也可查看，点词需先做 OCR。
                </span>
              </div>
              <label className="import-pdf__option">
                <input type="checkbox" checked={keepPdfPages} disabled={extracting || saving}
                  onChange={(event) => setKeepPdfPages(event.target.checked)} />
                保留原页图文（含图片、图表与公式，可放大）
              </label>
              <div role="status" aria-live="polite">
                {extracting && (
                  <div className="import-pdf__progress">
                    <span>{progress.total > 0 ? `正在提取 ${progress.completed} / ${progress.total} 页…` : '正在读取 PDF…'}</span>
                    <button className="btn btn--ghost" onClick={stopExtraction}>停止提取</button>
                  </div>
                )}
                {pdfSummary && <p className="hint import-pdf__summary">{pdfSummary}</p>}
              </div>
            </div>
          )}

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
            <label htmlFor="imp-text">{mode === 'pdf' ? '提取的正文（可修改） *' : '正文 *'}</label>
            <textarea
              id="imp-text"
              value={form.text}
              readOnly={extracting}
              onChange={(e) => update('text', e.target.value)}
              placeholder="把外刊正文粘贴到这里…"
            />
          </div>

          {error && <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>}
        </div>

        <div className="modal__foot">
          <button className="btn btn--primary" onClick={() => void handleSubmit()} disabled={extracting || saving}>
            {saving ? '正在保存图文…' : '导入并开始阅读'}
          </button>
          <button className="btn btn--ghost" onClick={onClose} disabled={saving}>
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
