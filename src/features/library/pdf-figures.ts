import type { PdfFigure } from '../../types'
import type { PdfTextItem } from './pdf-text'

type Box = [number, number, number, number]
interface Graphic { box: Box; raster: boolean; count: number }
interface PdfOperations {
  save: number; restore: number; transform: number
  paintFormXObjectBegin: number; paintFormXObjectEnd: number
  beginGroup: number; endGroup: number
  constructPath: number; endPath: number
  clip: number; eoClip: number
  paintImageXObject: number; paintInlineImageXObject: number; paintImageMaskXObject: number
  paintImageXObjectRepeat: number; paintImageMaskXObjectRepeat: number; paintInlineImageXObjectGroup: number
}

function multiply(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

function point(matrix: number[], x: number, y: number): [number, number] {
  return [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]]
}

function transformBox(box: Box, matrix: number[]): Box {
  const corners = [point(matrix, box[0], box[1]), point(matrix, box[2], box[1]),
    point(matrix, box[0], box[3]), point(matrix, box[2], box[3])]
  return [Math.min(...corners.map((p) => p[0])), Math.min(...corners.map((p) => p[1])),
    Math.max(...corners.map((p) => p[0])), Math.max(...corners.map((p) => p[1]))]
}

function union(a: Box, b: Box): Box {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
}

function near(a: Box, b: Box, distance: number): boolean {
  return a[0] <= b[2] + distance && b[0] <= a[2] + distance && a[1] <= b[3] + distance && b[1] <= a[3] + distance
}

/** Collect painted graphics, respecting save/restore, nested forms, and image transforms. */
export function findPdfFigures(
  list: { fnArray: number[]; argsArray: unknown[][] },
  ops: PdfOperations,
  viewport: { width: number; height: number; transform: number[] },
  textItems: PdfTextItem[],
  pageNumber: number,
): PdfFigure[] {
  let matrix = viewport.transform.slice()
  let clip: Box = [0, 0, viewport.width, viewport.height]
  let pendingClip = false
  const stack: Array<{ matrix: number[]; clip: Box }> = []
  const graphics: Graphic[] = []
  function add(box: Box, raster: boolean, transform = matrix) {
    const painted = transformBox(box, transform)
    const clipped: Box = [Math.max(clip[0], painted[0]), Math.max(clip[1], painted[1]),
      Math.min(clip[2], painted[2]), Math.min(clip[3], painted[3])]
    const width = clipped[2] - clipped[0]
    const height = clipped[3] - clipped[1]
    if (!Number.isFinite(width + height) || width < 0 || height < 0) return
    // Ignore page backgrounds and tiny glyph fragments; retain thin chart lines
    // until connected paths have been merged into a complete figure.
    if (!raster && width * height > viewport.width * viewport.height * 0.8) return
    if (raster && (width < 18 || height < 18)) return
    if (!raster && width < 1 && height < 1) return
    graphics.push({ box: clipped, raster, count: 1 })
  }
  for (let index = 0; index < list.fnArray.length; index += 1) {
    const operation = list.fnArray[index]
    const args = list.argsArray[index]
    if (operation === ops.save || operation === ops.paintFormXObjectBegin || operation === ops.beginGroup) {
      stack.push({ matrix: matrix.slice(), clip: clip.slice() as Box })
      if (operation === ops.paintFormXObjectBegin && Array.isArray(args[0])) matrix = multiply(matrix, args[0])
      if (operation === ops.paintFormXObjectBegin && args[1]) {
        const bounds = transformBox(args[1] as Box, matrix)
        clip = [Math.max(clip[0], bounds[0]), Math.max(clip[1], bounds[1]), Math.min(clip[2], bounds[2]), Math.min(clip[3], bounds[3])]
      }
    } else if (operation === ops.restore || operation === ops.paintFormXObjectEnd || operation === ops.endGroup) {
      const saved = stack.pop()
      matrix = saved?.matrix ?? viewport.transform.slice()
      clip = saved?.clip ?? [0, 0, viewport.width, viewport.height]
    } else if (operation === ops.transform) {
      matrix = multiply(matrix, args as number[])
    } else if (operation === ops.clip || operation === ops.eoClip) {
      pendingClip = true
    } else if (operation === ops.constructPath && args[2]) {
      const bounds = Array.from(args[2] as ArrayLike<number>) as Box
      if (args[0] !== ops.endPath) add(bounds, false)
      if (pendingClip) {
        const transformed = transformBox(bounds, matrix)
        clip = [Math.max(clip[0], transformed[0]), Math.max(clip[1], transformed[1]),
          Math.min(clip[2], transformed[2]), Math.min(clip[3], transformed[3])]
        pendingClip = false
      }
    } else if ([ops.paintImageXObject, ops.paintInlineImageXObject, ops.paintImageMaskXObject].includes(operation)) {
      add([0, 0, 1, 1], true)
    } else if (operation === ops.paintImageXObjectRepeat || operation === ops.paintImageMaskXObjectRepeat) {
      const positions = args[3] as number[]
      for (let offset = 0; offset < positions.length; offset += 2) {
        add([0, 0, 1, 1], true, multiply(matrix, [Number(args[1]), 0, 0, Number(args[2]), positions[offset], positions[offset + 1]]))
      }
    } else if (operation === ops.paintInlineImageXObjectGroup) {
      for (const image of args[1] as Array<{ transform: number[] }>) add([0, 0, 1, 1], true, multiply(matrix, image.transform))
    }
  }

  const groups: Graphic[] = []
  for (const graphic of graphics) {
    let merged = graphic
    for (let index = 0; index < groups.length;) {
      if (near(merged.box, groups[index].box, 10)) {
        const other = groups.splice(index, 1)[0]
        merged = { box: union(merged.box, other.box), raster: merged.raster || other.raster, count: merged.count + other.count }
        index = 0
      } else index += 1
    }
    groups.push(merged)
  }

  const textBoxes = textItems.filter((item) => item.str.trim()).map((item) => ({
    text: item.str,
    box: transformBox([item.transform[4], item.transform[5], item.transform[4] + item.width, item.transform[5] + item.height], viewport.transform),
  }))
  const captions = textBoxes.filter((item) => /^(?:fig(?:ure)?\.?\s*\d|图\s*\d|table\s*\d)/i.test(item.text.trim()))

  return groups
    .filter(({ box, raster, count }) => {
      const width = box[2] - box[0]
      const height = box[3] - box[1]
      // OCR PDFs often contain a full-page background scan plus selectable
      // text. Keep the text readable instead of duplicating it as a page image.
      if (width * height > viewport.width * viewport.height * 0.7 && textBoxes.length > 20) return false
      return width >= 30 && height >= 24 && width * height >= 1200 && (raster || count >= 2)
    })
    .sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0])
    .map(({ box, raster }, index) => {
      const caption = captions.find((item) => item.box[1] >= box[3] - 4 && item.box[1] - box[3] < 55 &&
        item.box[0] < box[2] && item.box[2] > box[0])
      // A little padding preserves chart axis labels drawn just beyond its paths;
      // never include a nearby caption or ordinary body paragraph in the crop.
      const padding = raster ? 1 : 6
      const rect: Box = [Math.max(0, box[0] - padding) / viewport.width,
        Math.max(0, box[1] - padding) / viewport.height,
        Math.min(viewport.width, box[2] + padding) / viewport.width,
        Math.min(viewport.height, Math.min(box[3] + padding, caption?.box[1] ?? Infinity)) / viewport.height]
      return { index: index + 1, pageNumber, rect, label: caption?.text.trim().match(/^(?:fig(?:ure)?\.?\s*\d+|图\s*\d+|table\s*\d+)/i)?.[0] || `图片 ${index + 1}` }
    })
}

export function textInsideFigure(item: PdfTextItem, figure: PdfFigure, viewport: { width: number; height: number; transform: number[] }): boolean {
  const [x, y] = point(viewport.transform, item.transform[4] + item.width / 2, item.transform[5] + item.height / 2)
  return x / viewport.width > figure.rect[0] && x / viewport.width < figure.rect[2] &&
    y / viewport.height > figure.rect[1] && y / viewport.height < figure.rect[3]
}
