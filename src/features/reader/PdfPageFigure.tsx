import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { pdfFileStore } from '@/lib/storage'
import type { PdfFigure as PdfFigureData } from '@/types'

const PdfContext = createContext<{ document: PDFDocumentProxy | null; error: string }>({ document: null, error: '' })

/** One shared document/worker per article, loaded only for PDF articles. */
export function PdfDocumentProvider({ fileId, children }: { fileId?: string; children: ReactNode }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!fileId) return
    let cancelled = false
    let task: PDFDocumentLoadingTask | undefined
    async function load() {
      try {
        const file = await pdfFileStore.get(fileId!)
        if (!file) throw new Error('本机未找到原 PDF，请重新导入这份 PDF 以恢复图文。')
        const { openPdf } = await import('../library/pdf')
        const bytes = new Uint8Array(await file.arrayBuffer())
        if (cancelled) return
        task = openPdf(bytes)
        const pdf = await task.promise
        if (!cancelled) setDocument(pdf)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'PDF 图文加载失败，请刷新后重试。')
      }
    }
    void load()
    return () => {
      cancelled = true
      void task?.destroy().catch(() => {})
    }
  }, [fileId])

  return <PdfContext.Provider value={{ document, error }}>{children}</PdfContext.Provider>
}

function PdfFigureCanvas({ figure, active, large = false }: { figure: PdfFigureData; active: boolean; large?: boolean }) {
  const { document, error } = useContext(PdfContext)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [renderError, setRenderError] = useState('')
  const [ready, setReady] = useState(false)
  const [ratio, setRatio] = useState(1 / 1.414)

  useEffect(() => {
    if (!document || !active) return
    let cancelled = false
    let renderTask: RenderTask | undefined
    const canvas = canvasRef.current!
    async function render() {
      try {
        const page = await document!.getPage(figure.pageNumber)
        if (cancelled) return
        const natural = page.getViewport({ scale: 1 })
        const limit = large ? 2400 : 1200
        const width = natural.width * (figure.rect[2] - figure.rect[0])
        const height = natural.height * (figure.rect[3] - figure.rect[1])
        const scale = Math.min(large ? 4 : 3, limit / width, limit * 1.5 / height)
        const viewport = page.getViewport({ scale })
        setRatio(width / height)
        canvas.width = Math.ceil(width * scale)
        canvas.height = Math.ceil(height * scale)
        renderTask = page.render({ canvas, viewport, transform: [1, 0, 0, 1,
          -figure.rect[0] * viewport.width, -figure.rect[1] * viewport.height] })
        await renderTask.promise
        if (!cancelled) {
          setReady(true)
          setRenderError('')
        }
      } catch (cause) {
        if (!cancelled) setRenderError(cause instanceof Error ? cause.message : '这一页渲染失败')
      }
    }
    void render()
    return () => {
      cancelled = true
      renderTask?.cancel()
      canvas.width = 0
      canvas.height = 0
    }
  }, [document, figure, active, large])

  const failure = error || renderError
  return (
    <div className={`pdf-page__surface${large ? ' pdf-page__surface--large' : ''}`} style={{ aspectRatio: ratio }}>
      <canvas ref={canvasRef} role="img" aria-label={`${figure.label}（PDF 第 ${figure.pageNumber} 页）`}
        style={{ visibility: active && ready && !failure ? 'visible' : 'hidden' }} />
      {failure ? <span className="pdf-page__message" role="status">{failure}</span> : (
        (!active || !ready) && <span className="pdf-page__message">{active ? '正在加载图片…' : figure.label}</span>
      )}
    </div>
  )
}

export function PdfFigure({ figure }: { figure: PdfFigureData }) {
  const figureRef = useRef<HTMLElement>(null)
  const [nearby, setNearby] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!figureRef.current) return
    const observer = new IntersectionObserver(([entry]) => setNearby(entry.isIntersecting), { rootMargin: '500px' })
    observer.observe(figureRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!expanded) return
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setExpanded(false)
        triggerRef.current?.focus()
      }
      if (event.key === 'Tab') {
        event.preventDefault()
        closeRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expanded])

  return (
    <figure className="pdf-page" ref={figureRef}>
      <figcaption className="pdf-page__caption">
        <span>{figure.label} · PDF 第 {figure.pageNumber} 页</span>
        <button ref={triggerRef} className="btn btn--ghost" onClick={() => setExpanded(true)} aria-label={`放大查看 ${figure.label}（第 ${figure.pageNumber} 页）`}>
          放大查看
        </button>
      </figcaption>
      <PdfFigureCanvas figure={figure} active={nearby} />
      {expanded && (
        <div className="pdf-lightbox" onClick={() => { setExpanded(false); triggerRef.current?.focus() }}>
          <section className="pdf-lightbox__dialog" role="dialog" aria-modal="true" aria-label={`${figure.label} 大图`}
            onClick={(event) => event.stopPropagation()}>
            <div className="pdf-lightbox__head">
              <strong>{figure.label} · PDF 第 {figure.pageNumber} 页</strong>
              <button ref={closeRef} className="btn" onClick={() => { setExpanded(false); triggerRef.current?.focus() }}>关闭大图</button>
            </div>
            <div className="pdf-lightbox__body"><PdfFigureCanvas figure={figure} active large /></div>
          </section>
        </div>
      )}
    </figure>
  )
}

/** Previously imported PDFs still have the source file: show isolated graphics,
 * never fall back to a full-page screenshot. Reimporting adds precise anchors. */
export function PdfPageFigures({ pageNumber }: { pageNumber: number }) {
  const { document, error: documentError } = useContext(PdfContext)
  const [figures, setFigures] = useState<PdfFigureData[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    if (!document) return
    let cancelled = false
    async function load() {
      try {
        const { extractPageFigures } = await import('../library/pdf')
        const page = await document!.getPage(pageNumber)
        const result = await extractPageFigures(page)
        if (!cancelled) setFigures(result)
      } catch {
        if (!cancelled) setError('这页的图片识别失败，正文仍可阅读。重新导入 PDF 可重试。')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [document, pageNumber])
  return <>{figures.map((figure) => <PdfFigure key={figure.index} figure={figure} />)}
    {pageNumber === 1 && documentError && <p className="hint">{documentError}</p>}
    {error && <p className="hint">{error}</p>}</>
}
