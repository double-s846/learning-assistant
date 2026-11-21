/** Human-readable page markers keep edited text aligned with the source PDF. */
export function pdfPageMarker(pageNumber: number): string {
  return `【PDF 第 ${pageNumber} 页】`
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
