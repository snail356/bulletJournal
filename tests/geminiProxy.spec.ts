import { describe, expect, it, vi } from 'vitest'
import {
  geminiPublicStatus,
  proxyGeminiGenerate,
  readGeminiEnv,
} from '../server/geminiProxy'

const env = { apiKey: 'server-key', model: 'gemini-test' }

describe('readGeminiEnv', () => {
  it('優先讀沒有 VITE_ 前綴的變數', () => {
    expect(
      readGeminiEnv({
        GEMINI_API_KEY: ' server ',
        VITE_GEMINI_API_KEY: 'client',
        GEMINI_MODEL: ' custom ',
      }),
    ).toEqual({ apiKey: 'server', model: 'custom' })
  })

  it('舊的 VITE_ 名稱仍可讓伺服器讀到，但預設模型有缺省值', () => {
    expect(readGeminiEnv({ VITE_GEMINI_API_KEY: 'legacy' })).toEqual({
      apiKey: 'legacy',
      model: 'gemini-3.5-flash',
    })
  })
})

describe('proxyGeminiGenerate', () => {
  it('沒有 Key 時不呼叫上游', async () => {
    const fetchImpl = vi.fn()
    const result = await proxyGeminiGenerate(
      { systemInstruction: 'hi', contents: [{ role: 'user', text: 'q' }] },
      { apiKey: '', model: 'gemini-test' },
      fetchImpl,
    )
    expect(result.status).toBe(500)
    expect(result.body.error).toContain('GEMINI_API_KEY')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('用伺服器的模型與 Key 轉送，並只回文字', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '  回答  ' }] } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const result = await proxyGeminiGenerate(
      {
        systemInstruction: '角色',
        contents: [{ role: 'user', text: '問題' }],
        temperature: 2,
      },
      env,
      fetchImpl,
    )

    expect(result).toEqual({ status: 200, body: { text: '回答' } })
    expect(geminiPublicStatus(env)).toEqual({
      configured: true,
      model: 'gemini-test',
    })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
    )
    expect(init.headers['x-goog-api-key']).toBe('server-key')
    const sent = JSON.parse(init.body)
    expect(sent.generationConfig.temperature).toBe(1)
    expect(sent.generationConfig.maxOutputTokens).toBe(4096)
  })

  it('拒絕空內容', async () => {
    const result = await proxyGeminiGenerate({ contents: [] }, env, vi.fn())
    expect(result.status).toBe(400)
  })
})
