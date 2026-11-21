import test from 'node:test'
import assert from 'node:assert/strict'
import { pdfPageMarker, splitPdfText } from '../src/features/library/pdf-pages.ts'

test('PDF 页码标记保留文字与原页对应关系，包括空白扫描页', () => {
  const text = [pdfPageMarker(1), 'First page.', pdfPageMarker(2), '', pdfPageMarker(3), 'Third page.'].join('\n\n')
  const pages = splitPdfText(text, 3)
  assert.deepEqual(pages.map((page) => [page.pageNumber, page.text.trim()]), [
    [1, 'First page.'], [2, ''], [3, 'Third page.'],
  ])
})

test('PDF 正文编辑后保留对应页码，普通文章中的相似文字不会被误删除', () => {
  assert.deepEqual(splitPdfText('Preface.\r\n【PDF 第 2 页】\r\nEdited text.', 3).map((page) => ({
    text: page.text.trim(), page: page.pageNumber,
  })), [{ text: 'Preface.', page: undefined }, { text: 'Edited text.', page: 2 }])
  const unchanged = 'The phrase 【PDF 第 1 页】 is in this sentence.\n【PDF 第 99 页】'
  assert.equal(splitPdfText(unchanged, 3)[0].text, unchanged)
})
