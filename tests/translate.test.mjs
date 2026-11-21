import test from 'node:test'
import assert from 'node:assert/strict'
import { translateToChinese } from '../src/lib/translate.ts'

test('翻译英文释义为中文，不需要 API key', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = async (input) => {
    requestedUrl = String(input)
    return new Response(
      JSON.stringify({ responseStatus: 200, responseData: { translatedText: '仔细思考某事' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    assert.equal(await translateToChinese('to think carefully'), '仔细思考某事')
    assert.match(requestedUrl, /langpair=en%7Czh-CN/)
    assert.match(requestedUrl, /q=to\+think\+carefully/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('翻译接口失败或仍返回原英文时返回 null', async () => {
  const originalFetch = globalThis.fetch

  try {
    globalThis.fetch = async () => new Response('{}', { status: 503 })
    assert.equal(await translateToChinese('hello'), null)

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ responseStatus: 200, responseData: { translatedText: 'hello' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    assert.equal(await translateToChinese('hello'), null)
  } finally {
    globalThis.fetch = originalFetch
  }
})
