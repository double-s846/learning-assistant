/** Human-readable page markers keep edited text aligned with the source PDF. */
export function pdfPageMarker(pageNumber: number): string {
  return `【PDF 第 ${pageNumber} 页】`
}

export function pdfFigureMarker(index: number): string {
  return `【PDF 图片 ${index}】`
}

export function splitPdfFigures(text: string, validIndices: Set<number>): Array<{ text: string; figure?: number }> {
  const blocks: Array<{ text: string; figure?: number }> = []
  let start = 0
  for (const marker of text.matchAll(/^【PDF 图片 (\d+)】[ \t]*\r?$/gm)) {
    if (!validIndices.has(Number(marker[1]))) continue
    blocks.push({ text: text.slice(start, marker.index) })
    blocks.push({ text: '', figure: Number(marker[1]) })
    start = marker.index + marker[0].length
  }
  blocks.push({ text: text.slice(start) })
  return blocks
}

export function splitPdfText(text: string, pageCount: number): Array<{ text: string; pageNumber?: number }> {
  const sections: Array<{ text: string; pageNumber?: number }> = []
  const markers = [...text.matchAll(/^【PDF 第 (\d+) 页】[ \t]*\r?$/gm)]
    .filter((match) => Number(match[1]) >= 1 && Number(match[1]) <= pageCount)
  let start = 0
  let pageNumber: number | undefined
  for (const marker of markers) {
    if (marker.index > start) sections.push({ text: text.slice(start, marker.index), pageNumber })
    pageNumber = Number(marker[1])
    start = marker.index + marker[0].length
  }
  sections.push({ text: text.slice(start), pageNumber })
  return sections
}
