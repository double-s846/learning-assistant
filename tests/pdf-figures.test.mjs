import test from 'node:test'
import assert from 'node:assert/strict'
import { findPdfFigures, textInsideFigure } from '../src/features/library/pdf-figures.ts'
import { pdfFigureMarker, splitPdfFigures } from '../src/features/library/pdf-pages.ts'

const OPS = {
  save: 10, restore: 11, transform: 12, endPath: 28, clip: 29, eoClip: 30,
  paintFormXObjectBegin: 74, paintFormXObjectEnd: 75, beginGroup: 76, endGroup: 77,
  paintImageMaskXObject: 83, paintImageXObject: 85, paintInlineImageXObject: 86,
  paintInlineImageXObjectGroup: 87, paintImageXObjectRepeat: 88,
  paintImageMaskXObjectRepeat: 89, constructPath: 91,
}
const viewport = { width: 600, height: 800, transform: [1, 0, 0, -1, 0, 800] }
const operations = (...items) => ({ fnArray: items.map((item) => item[0]), argsArray: items.map((item) => item[1]) })

test('PDF 图片：只裁出照片所在区域，恢复坐标后不会把后续图片合并', () => {
  const figures = findPdfFigures(operations(
    [OPS.save, []], [OPS.transform, [150, 0, 0, 100, 50, 500]], [OPS.paintImageXObject, ['photo']], [OPS.restore, []],
    [OPS.save, []], [OPS.transform, [120, 0, 0, 90, 350, 200]], [OPS.paintInlineImageXObject, [{}]], [OPS.restore, []],
  ), OPS, viewport, [], 1)
  assert.equal(figures.length, 2)
  assert.ok(figures[0].rect[2] - figures[0].rect[0] < 0.3)
  assert.ok(figures[0].rect[3] - figures[0].rect[1] < 0.2)
  assert.ok(figures[1].rect[0] > 0.5)
})

test('PDF 图表：合并矢量绘图部件，并且不会吞掉图注下的正文', () => {
  const text = (str, y) => ({ str, transform: [1, 0, 0, 10, 50, y], width: 160, height: 10 })
  const items = [text('Figure 1. Experiment results.', 470), text('The following body stays selectable.', 430)]
  const figures = findPdfFigures(operations(
    [OPS.constructPath, [20, [], [50, 500, 200, 600]]],
    [OPS.constructPath, [20, [], [55, 505, 190, 590]]],
  ), OPS, viewport, items, 2)
  assert.equal(figures.length, 1)
  assert.equal(figures[0].label, 'Figure 1')
  assert.equal(textInsideFigure(items[1], figures[0], viewport), false)
})

test('PDF 图表：遵守嵌套 Form 的剪裁边界，避免把整页正文裁进图表', () => {
  const figures = findPdfFigures(operations(
    [OPS.paintFormXObjectBegin, [[1, 0, 0, 1, 0, 0], [50, 500, 250, 650]]],
    [OPS.constructPath, [20, [], [-500, -500, 1000, 1000]]],
    [OPS.constructPath, [20, [], [100, 550, 200, 600]]],
    [OPS.paintFormXObjectEnd, []],
  ), OPS, viewport, [], 3)
  assert.equal(figures.length, 1)
  assert.ok(figures[0].rect[2] - figures[0].rect[0] < 0.4)
  assert.ok(figures[0].rect[3] - figures[0].rect[1] < 0.25)
})

test('PDF 纯文字页面和单条装饰线不生成整页图片', () => {
  const figures = findPdfFigures(operations([OPS.constructPath, [20, [], [40, 700, 560, 700]]]), OPS, viewport, [], 1)
  assert.deepEqual(figures, [])
})

test('PDF 带 OCR 正文的整页背景扫描图不重复显示；纯扫描件仍能查看图片', () => {
  const list = operations([OPS.transform, [600, 0, 0, 800, 0, 0]], [OPS.paintImageXObject, ['scan']])
  const items = Array.from({ length: 30 }, (_, index) => ({
    str: `OCR body line ${index}`, width: 400, height: 10, transform: [1, 0, 0, 10, 50, 700 - index * 14],
  }))
  assert.equal(findPdfFigures(list, OPS, viewport, items, 1).length, 0)
  assert.equal(findPdfFigures(list, OPS, viewport, [], 1).length, 1)
})

test('PDF 图片标记可编辑位置，并保留文字块且不识别不存在的图片编号', () => {
  const content = `Before.\n\n${pdfFigureMarker(3)}\n\nAfter.\n【PDF 图片 99】`
  const blocks = splitPdfFigures(content, new Set([3]))
  assert.equal(blocks[1].figure, 3)
  assert.equal(blocks[2].text.trim(), 'After.\n【PDF 图片 99】')
})
