/**
 * 统一 id 生成。不要在业务代码里手写 Math.random()，否则排序和去重会出问题。
 * 优先用浏览器原生 crypto.randomUUID（离线可用），旧环境降级到时间戳 + 随机。
 */
export function createId(prefix = ''): string {
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

  return prefix ? `${prefix}_${raw}` : raw
}

/** 按 id 前缀判断类型，便于调试时一眼看出对象来源 */
export const ID_PREFIX = {
  article: 'art',
  paragraph: 'p',
  sentence: 's',
  vocab: 'v',
  parse: 'sp',
} as const
