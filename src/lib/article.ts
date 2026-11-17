/**
 * 契约实现层：把「原始文本」变成 Article / Paragraph / Sentence。
 *
 * 切段、切句、算阅读时长都在这里做一次并落到数据结构上，
 * 下游（生词卡、长句解析、TTS 逐句高亮）直接读，不再重复切文本 ——
 * 这是保证「点词位置」和「高亮位置」永远对得上的关键。
 */

import type { Article, Paragraph, Sentence } from '@/types'
import type { SeedArticle } from '@/data/sample-articles'
import { createId, ID_PREFIX } from './id'
import { estimateReadingMinutes, splitParagraphs, splitSentences } from './tokenize'

export interface ArticleInput {
  title: string
  source: string
  text: string
  sourceUrl?: string
  author?: string
  license: string
}

export function buildArticle(input: ArticleInput): Article {
  const blocks = splitParagraphs(input.text)
  const paragraphs: Paragraph[] = blocks.map((text, index) => ({
    id: createId(ID_PREFIX.paragraph),
    index,
    text,
  }))

  return {
    id: createId(ID_PREFIX.article),
    title: input.title.trim() || '未命名文章',
    source: input.source.trim() || '未知来源',
    sourceUrl: input.sourceUrl?.trim() || undefined,
    author: input.author?.trim() || undefined,
    license: input.license.trim() || '来源未标注',
    importedAt: new Date().toISOString(),
    paragraphs,
    readingMinutes: estimateReadingMinutes(blocks.join(' ')),
  }
}

export function articleFromSeed(seed: SeedArticle): Article {
  return buildArticle({
    title: seed.title,
    source: seed.source,
    text: seed.body,
    sourceUrl: seed.sourceUrl,
    author: seed.author,
    license: seed.license,
  })
}

/**
 * 句子 id 用「段落 id + 序号」拼成**确定性**字符串，
 * 这样刷新页面后生词卡的 context.sentenceId 依然能对上原句。
 */
export function sentenceIdOf(paragraphId: string, index: number): string {
  return `${paragraphId}#${index}`
}

const sentenceCache = new Map<string, Sentence[]>()

function cacheKey(article: Article): string {
  return `${article.id}|${article.paragraphs.length}|${article.paragraphs[0]?.text.length ?? 0}`
}

/** 取整篇文章的句子（带缓存，渲染时不要每次重算） */
export function getSentences(article: Article): Sentence[] {
  const key = cacheKey(article)
  const hit = sentenceCache.get(key)
  if (hit) return hit

  const sentences: Sentence[] = []
  for (const paragraph of article.paragraphs) {
    splitSentences(paragraph.text).forEach((span, index) => {
      sentences.push({
        id: sentenceIdOf(paragraph.id, index),
        paragraphId: paragraph.id,
        start: span.start,
        end: span.end,
        text: span.text,
        index,
      })
    })
  }

  sentenceCache.set(key, sentences)
  return sentences
}

/** 按段落分组，reader 渲染时直接消费 */
export function getSentencesByParagraph(article: Article): Map<string, Sentence[]> {
  const grouped = new Map<string, Sentence[]>()
  for (const sentence of getSentences(article)) {
    const list = grouped.get(sentence.paragraphId) ?? []
    list.push(sentence)
    grouped.set(sentence.paragraphId, list)
  }
  return grouped
}

export function findSentence(article: Article, paragraphId: string, sentenceId: string): Sentence | undefined {
  return getSentences(article).find((s) => s.id === sentenceId && s.paragraphId === paragraphId)
}

/** 该词在整篇文章里出现了几次（用于「本词在本文出现 3 次」这类提示） */
export function countOccurrences(article: Article, lemma: string): number {
  const re = new RegExp(`\\b${lemma.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'gi')
  return article.paragraphs.reduce((sum, p) => sum + (p.text.match(re)?.length ?? 0), 0)
}
