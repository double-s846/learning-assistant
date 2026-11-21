import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { pdfFileStore } from '@/lib/storage'

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

function PdfPageCanvas({ pageNumber, active, large = false }: { pageNumber: number; active: boolean; large?: boolean }) {
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
        const page = await document!.getPage(pageNumber)
        if (cancelled) return
        const natural = page.getViewport({ scale: 1 })
        const limit = large ? 2400 : 1200
        const scale = Math.min(large ? 3 : 2, limit / natural.width, limit * 1.5 / natural.height)
        const viewport = page.getViewport({ scale })
        setRatio(viewport.width / viewport.height)
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        renderTask = page.render({ canvas, viewport })
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
  }, [document, pageNumber, active, large])

  const failure = error || renderError
  return (
    <div className={`pdf-page__surface${large ? ' pdf-page__surface--large' : ''}`} style={{ aspectRatio: ratio }}>
      <canvas ref={canvasRef} role="img" aria-label={`PDF 第 ${pageNumber} 页原版图文`}
        style={{ visibility: active && ready && !failure ? 'visible' : 'hidden' }} />
      {failure ? <span className="pdf-page__message" role="status">{failure}</span> : (
        (!active || !ready) && <span className="pdf-page__message">{active ? '正在加载原页图文…' : `PDF 第 ${pageNumber} 页`}</span>
      )}
    </div>
  )
}

export function PdfPageFigure({ pageNumber }: { pageNumber: number }) {
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
        <span>PDF 第 {pageNumber} 页 · 原版图文</span>
        <button ref={triggerRef} className="btn btn--ghost" onClick={() => setExpanded(true)} aria-label={`放大查看 PDF 第 ${pageNumber} 页`}>
          放大查看
        </button>
      </figcaption>
      <PdfPageCanvas pageNumber={pageNumber} active={nearby} />
      {expanded && (
        <div className="pdf-lightbox" onClick={() => { setExpanded(false); triggerRef.current?.focus() }}>
          <section className="pdf-lightbox__dialog" role="dialog" aria-modal="true" aria-label={`PDF 第 ${pageNumber} 页大图`}
            onClick={(event) => event.stopPropagation()}>
            <div className="pdf-lightbox__head">
              <strong>PDF 第 {pageNumber} 页 · 可滚动查看大图</strong>
              <button ref={closeRef} className="btn" onClick={() => { setExpanded(false); triggerRef.current?.focus() }}>关闭大图</button>
            </div>
            <div className="pdf-lightbox__body"><PdfPageCanvas pageNumber={pageNumber} active large /></div>
          </section>
        </div>
      )}
    </figure>
  )
}
