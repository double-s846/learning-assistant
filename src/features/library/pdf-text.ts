/** Coordinates supplied by PDF.js. Keeping layout independent makes it testable without a browser. */
export interface PdfTextItem {
  str: string
  transform: number[]
  width: number
  height: number
}

interface Line {
  text: string
  x: number
  right: number
  y: number
  height: number
}

function joinText(before: string, after: string): string {
  // Repair a word split across two printed lines, e.g. learn-\ning.
  if (/[a-z]-$/i.test(before) && /^[a-z]/.test(after)) return before.slice(0, -1) + after
  if (/[\u3400-\u9fff]$/.test(before) && /^[\u3400-\u9fff]/.test(after)) return before + after
  return `${before} ${after}`
}

function paragraphs(lines: Line[]): string {
  const blocks: string[] = []
  let current = ''
  let previous: Line | undefined
  for (const line of lines) {
    if (/^【PDF 图片 \d+】$/.test(line.text)) {
      if (current) blocks.push(current)
      blocks.push(line.text)
      current = ''
      previous = undefined
      continue
    }
    const gap = previous ? previous.y - line.y : 0
    const newParagraph = previous && (
      gap > Math.max(18, previous.height * 1.8) ||
      Math.abs(previous.height - line.height) > Math.max(2, previous.height * 0.25) ||
      (line.x - previous.x > line.height * 1.2 && /[.!?。！？:]$/.test(previous.text))
    )
    if (newParagraph && current) {
      blocks.push(current)
      current = ''
    }
    current = current ? joinText(current, line.text) : line.text
    previous = line
  }
  if (current) blocks.push(current)
  return blocks.join('\n\n')
}

/** Reconstruct lines and the reading order of common single/two-column papers. */
export function pdfPageToText(items: PdfTextItem[], pageWidth: number): string {
  const sorted = items
    .filter((item) => item.str.trim() && item.transform.length >= 6)
    .map((item) => ({
      text: item.str.replace(/\u00ad/g, '').trim(),
      x: item.transform[4],
      right: item.transform[4] + item.width,
      y: item.transform[5],
      height: Math.max(1, Math.abs(item.height)),
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x)

  // Group only items with nearly identical baselines; columns on the same row
  // remain separate if there is a substantial horizontal gap.
  const rows: Line[][] = []
  for (const item of sorted) {
    const row = rows.at(-1)
    if (row && Math.abs(row[0].y - item.y) <= Math.max(2, Math.min(row[0].height, item.height) * 0.25)) {
      row.push(item)
    } else {
      rows.push([item])
    }
  }

  // PDF authors and citations often have superscripts on a slightly higher
  // baseline. Attach small glyphs to the next baseline instead of making an
  // isolated paragraph for each affiliation marker.
  const alignedRows: Line[][] = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const next = rows[index + 1]
    if (next && row.every((item) => item.height < next[0].height * 0.85) &&
      row[0].y - next[0].y < next[0].height * 0.9) {
      next.push(...row)
    } else {
      alignedRows.push(row)
    }
  }

  const lines: Line[] = []
  for (const row of alignedRows) {
    row.sort((a, b) => a.x - b.x)
    const baseline = Math.min(...row.map((item) => item.y))
    const rowHeight = Math.max(...row.map((item) => item.height))
    let current = { ...row[0], y: baseline, height: rowHeight }
    for (const item of row.slice(1)) {
      const gap = item.x - current.right
      if (gap > Math.max(18, current.height * 2)) {
        lines.push(current)
        current = { ...item, y: baseline, height: rowHeight }
      } else {
        const separator = gap > current.height * 0.15 && !/[\u3400-\u9fff]$/.test(current.text) ? ' ' : ''
        current.text += separator + item.text
        current.right = Math.max(current.right, item.right)
      }
    }
    lines.push(current)
  }

  const midpoint = pageWidth / 2
  const left = lines.filter((line) => line.x < midpoint && line.right < midpoint + 8)
  const right = lines.filter((line) => line.x >= midpoint - 8)
  if (left.length < 3 || right.length < 3) return paragraphs(lines)

  const blocks: string[] = []
  let band: Line[] = []
  let wideBand: Line[] = []
  function flushWideBand() {
    if (wideBand.length) blocks.push(paragraphs(wideBand))
    wideBand = []
  }
  function flushBand() {
    const leftText = paragraphs(band.filter((line) => line.x < midpoint - 8))
    const rightText = paragraphs(band.filter((line) => line.x >= midpoint - 8))
    if (leftText) blocks.push(leftText)
    if (rightText) blocks.push(rightText)
    band = []
  }
  for (const line of lines) {
    if (line.x < midpoint - 8 && line.right > midpoint + 8) {
      flushBand()
      wideBand.push(line)
    } else {
      flushWideBand()
      band.push(line)
    }
  }
  flushBand()
  flushWideBand()
  return blocks.join('\n\n')
}
