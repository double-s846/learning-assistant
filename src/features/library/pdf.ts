import { getDocument, GlobalWorkerOptions, OPS } from 'pdfjs-dist'
import type { PDFPageProxy } from 'pdfjs-dist'
import type { PdfFigure } from '@/types'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { pdfPageToText } from './pdf-text'
import { pdfPageMarker, pdfFigureMarker } from './pdf-pages'
import { findPdfFigures, textInsideFigure } from './pdf-figures'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// Bundle PDF.js font maps locally as well, so CJK and standard-font PDFs do not
// depend on a CDN. Only assets requested by a document are fetched at runtime.
const cMaps = import.meta.glob<string>('/node_modules/pdfjs-dist/cmaps/*.bcmap', {
  eager: true, query: '?url&no-inline', import: 'default',
})
const standardFonts = import.meta.glob<string>('/node_modules/pdfjs-dist/standard_fonts/*', {
  eager: true, query: '?url&no-inline', import: 'default',
})
const wasmFiles = import.meta.glob<string>([
  '/node_modules/pdfjs-dist/wasm/*.wasm',
  '/node_modules/pdfjs-dist/wasm/LICENSE_*',
], {
  eager: true, query: '?url&no-inline', import: 'default',
})

async function readAsset(assets: Record<string, string>, filename: string): Promise<Uint8Array> {
  const path = Object.keys(assets).find((key) => key.endsWith(`/${filename}`))
  if (!path) throw new Error(`PDF font asset not found: ${filename}`)
  const response = await fetch(assets[path])
  if (!response.ok) throw new Error(`PDF font asset could not be loaded: ${filename}`)
  return new Uint8Array(await response.arrayBuffer())
}

class BundledCMapReader {
  async fetch({ name }: { name: string }) {
    return { cMapData: await readAsset(cMaps, `${name}.bcmap`), compressionType: 1 }
  }
}

class BundledStandardFontReader {
  async fetch({ filename }: { filename: string }) {
    return readAsset(standardFonts, filename)
  }
}

class BundledWasmReader {
  async fetch({ filename }: { filename: string }) {
    return readAsset(wasmFiles, filename)
  }
}

export function openPdf(data: Uint8Array) {
  return getDocument({
    data,
    isEvalSupported: false,
    useWorkerFetch: false,
    CMapReaderFactory: BundledCMapReader,
    StandardFontDataFactory: BundledStandardFontReader,
    WasmFactory: BundledWasmReader,
  })
}

export const MAX_PDF_BYTES = 30 * 1024 * 1024
const MAX_PDF_PAGES = 300
const MAX_TEXT_LENGTH = 1_000_000

interface PdfImportOptions {
  signal: AbortSignal
  onProgress: (completed: number, total: number) => void
}

export interface PdfImportResult {
  text: string
  title: string
  author: string
  pageCount: number
  emptyPages: number[]
  figures: PdfFigure[]
}

export async function extractPageFigures(page: PDFPageProxy): Promise<PdfFigure[]> {
  const content = await page.getTextContent()
  return findPdfFigures(await page.getOperatorList(), OPS, page.getViewport({ scale: 1 }),
    content.items.filter((item) => 'str' in item), page.pageNumber)
}

function metadataString(info: unknown, key: string): string {
  if (!info || typeof info !== 'object') return ''
  const value = (info as Record<string, unknown>)[key]
  return typeof value === 'string'
    ? Array.from(value).filter((character) => character.charCodeAt(0) >= 32).join('').trim()
    : ''
}

export async function extractPdf(file: File, { signal, onProgress }: PdfImportOptions): Promise<PdfImportResult> {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    throw new Error('请选择 PDF 格式的文件。')
  }
  if (file.size === 0) throw new Error('这个 PDF 是空文件，请重新选择。')
  if (file.size > MAX_PDF_BYTES) throw new Error('PDF 不能超过 30 MB，请拆分后再导入。')
  signal.throwIfAborted()
  const bytes = new Uint8Array(await file.arrayBuffer())
  signal.throwIfAborted()
  if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-')) {
    throw new Error('文件内容不是有效的 PDF，请检查文件后重试。')
  }

  const task = openPdf(bytes)
  const abort = () => { void task.destroy().catch(() => {}) }
  signal.addEventListener('abort', abort, { once: true })
  try {
    const pdf = await task.promise
    signal.throwIfAborted()
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error('PDF 超过 300 页，请拆分为章节后导入。')
    onProgress(0, pdf.numPages)
    const { info } = await pdf.getMetadata()
    const blocks: string[] = []
    const emptyPages: number[] = []
    const figures: PdfFigure[] = []
    let textLength = 0
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      signal.throwIfAborted()
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const viewport = page.getViewport({ scale: 1 })
      const items = content.items.filter((item) => 'str' in item)
      const pageFigures = findPdfFigures(await page.getOperatorList(), OPS, viewport, items, pageNumber)
        .map((figure, index) => ({ ...figure, index: figures.length + index + 1 }))
      figures.push(...pageFigures)
      const bodyItems = items.filter((item) => !pageFigures.some((figure) => textInsideFigure(item, figure, viewport)))
      const figureItems = pageFigures.map((figure) => {
        const [x, y] = viewport.convertToPdfPoint(figure.rect[0] * viewport.width, figure.rect[1] * viewport.height)
        return { str: pdfFigureMarker(figure.index), width: (figure.rect[2] - figure.rect[0]) * viewport.width,
          height: 10, transform: [1, 0, 0, 10, x, y] }
      })
      const text = pdfPageToText(
        [...bodyItems, ...figureItems],
        page.view[2] - page.view[0],
      )
      blocks.push(`${pdfPageMarker(pageNumber)}\n\n${text}`)
      if (!items.some((item) => item.str.trim())) emptyPages.push(pageNumber)
      textLength += text.length
      if (textLength > MAX_TEXT_LENGTH) throw new Error('PDF 提取的正文超过 100 万字符，请拆分后再导入。')
      page.cleanup()
      onProgress(pageNumber, pdf.numPages)
    }
    return {
      text: blocks.join('\n\n'),
      title: metadataString(info, 'Title') || file.name.replace(/\.pdf$/i, ''),
      author: metadataString(info, 'Author'),
      pageCount: pdf.numPages,
      emptyPages,
      figures,
    }
  } catch (error) {
    signal.throwIfAborted()
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new Error('这个 PDF 受密码保护，请先解锁或导出无密码版本后再导入。', { cause: error })
    }
    if (error instanceof Error && error.name === 'InvalidPDFException') {
      throw new Error('PDF 已损坏或格式无效，请重新下载或另存为 PDF 后再试。', { cause: error })
    }
    throw error
  } finally {
    signal.removeEventListener('abort', abort)
    await task.destroy().catch(() => {})
  }
}
