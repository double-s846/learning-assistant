import test from 'node:test'
import assert from 'node:assert/strict'
import { pdfPageToText } from '../src/features/library/pdf-text.ts'

const item = (str, x, y, width = 150, height = 10) => ({
  str, transform: [1, 0, 0, height, x, y], width, height,
})

test('PDF：合并正文行并修复行末断字，保留段落间距', () => {
  const text = pdfPageToText([
    item('Learning from experi-', 50, 700, 200),
    item('ence improves results.', 50, 686, 200),
    item('A separate paragraph.', 50, 650, 200),
  ], 600)
  assert.equal(text, 'Learning from experience improves results.\n\nA separate paragraph.')
})

test('PDF：双栏论文先读完左栏，再读右栏，全宽标题排在前面', () => {
  const items = [item('A full-width research paper heading', 50, 760, 500, 16)]
  for (let i = 0; i < 3; i++) {
    // Deliberately interleave the source items as many PDF producers do.
    items.push(item(`Left ${i + 1}.`, 50, 700 - i * 14, 220))
    items.push(item(`Right ${i + 1}.`, 330, 700 - i * 14, 220))
  }
  assert.equal(pdfPageToText(items, 600), [
    'A full-width research paper heading',
    'Left 1. Left 2. Left 3.',
    'Right 1. Right 2. Right 3.',
  ].join('\n\n'))
})

test('PDF：同一行的单词按位置重组，空页返回空字符串', () => {
  assert.equal(pdfPageToText([
    item('paper', 112, 700, 30),
    item('Research', 50, 700, 55),
    item(' ', 50, 680),
  ], 600), 'Research paper')
  assert.equal(pdfPageToText([], 600), '')
})

test('PDF：中文换行合并时不添加多余空格', () => {
  assert.equal(pdfPageToText([
    item('这是一篇', 50, 700),
    item('中文论文。', 50, 686),
  ], 600), '这是一篇中文论文。')
})

test('PDF：作者上标与姓名在同一行，不产生独立的符号段落', () => {
  assert.equal(pdfPageToText([
    item('Researcher', 50, 700, 60, 10),
    item('*', 110, 704, 4, 6),
  ], 600), 'Researcher*')
})
