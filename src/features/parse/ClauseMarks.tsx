import { useEffect, useRef } from 'react'
import type { Sentence } from '@/types'
import { getSentenceParse } from './cache'
import './clause-marks.css'

/** Range highlights preserve original DOM, word clicks, selection and wrapping. */
export function ClauseMarks({ sentence }: { sentence: Sentence }) {
  const anchor = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const host = anchor.current?.parentElement
    if (!host || !('highlights' in CSS) || typeof Highlight === 'undefined') return
    const parse = getSentenceParse(sentence.text, sentence.id)
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
    const nodes: Array<{ node: Node; start: number; end: number }> = []
    let offset = 0
    while (walker.nextNode()) {
      const node = walker.currentNode
      const end = offset + (node.textContent?.length ?? 0)
      nodes.push({ node, start: offset, end })
      offset = end
    }
    // Other overlays may introduce text; never mark uncertain offsets.
    const rendered = host.textContent ?? ''
    if (rendered !== sentence.text && rendered !== sentence.text + ' ') return
    const registered: Array<{ highlight: Highlight; range: Range; name: string }> = []
    for (const segment of parse.segments) {
      const start = nodes.find(n => n.start <= segment.start && n.end > segment.start)
      const end = nodes.find(n => n.start < segment.end && n.end >= segment.end)
      if (!start || !end) continue
      const range = document.createRange()
      range.setStart(start.node, segment.start - start.start)
      range.setEnd(end.node, segment.end - end.start)
      const name = `parse-${segment.kind}`
      const highlight = CSS.highlights.get(name) ?? new Highlight()
      highlight.add(range)
      CSS.highlights.set(name, highlight)
      registered.push({ highlight, range, name })
    }
    return () => {
      for (const { highlight, range, name } of registered) {
        highlight.delete(range)
        if (highlight.size === 0) CSS.highlights.delete(name)
      }
    }
  }, [sentence.id, sentence.text])
  return <span ref={anchor} aria-hidden="true" />
}
