interface TranslationResponse {
  responseStatus?: number
  responseData?: {
    translatedText?: string
  }
}

const TRANSLATE_API = 'https://api.mymemory.translated.net/get'

/** Translate a short English word or definition without requiring an API key. */
export async function translateToChinese(text: string, timeoutMs = 3500): Promise<string | null> {
  const query = text.trim()
  if (!query) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const params = new URLSearchParams({ q: query, langpair: 'en|zh-CN' })
    const response = await fetch(`${TRANSLATE_API}?${params}`, { signal: controller.signal })
    if (!response.ok) return null

    const data = (await response.json()) as TranslationResponse
    const translated = data.responseData?.translatedText?.trim()
    if (data.responseStatus !== 200 || !translated || translated.toLowerCase() === query.toLowerCase()) {
      return null
    }
    return translated
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
