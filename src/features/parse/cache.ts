import { analyzeSentence } from '../../lib/clause.ts'
import type { SentenceParse } from '../../types'

const cache = new Map<string, SentenceParse>()
/** Bounded LRU; clone on return so consumers cannot corrupt another sentence. */
export function getSentenceParse(text: string, sentenceId = ''): SentenceParse {
  let result = cache.get(text)
  if (!result) result = analyzeSentence(text)
  cache.delete(text)
  cache.set(text, result)
  if (cache.size > 200) cache.delete(cache.keys().next().value!)
  return { ...result, sentenceId, segments: result.segments.map(s => ({ ...s })), tips: result.tips?.slice() }
}
