export const maxDuration = 60

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'

const MAX_MESSAGES = 20
const MAX_MESSAGE_CHARS = 60_000
const MAX_SYSTEM_CHARS = 8_000

export interface GeminiProxyEnv {
  apiKey: string
  model: string
}

export interface GeminiPublicStatus {
  configured: boolean
  model: string
}

interface GeminiContentTurn {
  role: 'user' | 'model'
  text: string
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  error?: {
    message?: string
  }
}

export function readGeminiEnv(
  env: Record<string, string | undefined>,
): GeminiProxyEnv {
  const apiKey = (env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '').trim()
  const model =
    (env.GEMINI_MODEL || env.VITE_GEMINI_MODEL || '').trim() ||
    DEFAULT_GEMINI_MODEL
  return { apiKey, model }
}

export function geminiPublicStatus(env: GeminiProxyEnv): GeminiPublicStatus {
  return {
    configured: env.apiKey.length > 0,
    model: env.model,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseRequest(body: unknown):
  | {
      ok: true
      systemInstruction: string
      contents: GeminiContentTurn[]
      temperature: number
    }
  | { ok: false; error: string } {
  if (!isRecord(body)) return { ok: false, error: '請求格式不正確' }
  if (typeof body.systemInstruction !== 'string' || !body.systemInstruction.trim()) {
    return { ok: false, error: '缺少 systemInstruction' }
  }
  if (body.systemInstruction.length > MAX_SYSTEM_CHARS) {
    return { ok: false, error: 'systemInstruction 過長' }
  }
  if (
    !Array.isArray(body.contents) ||
    body.contents.length === 0 ||
    body.contents.length > MAX_MESSAGES
  ) {
    return { ok: false, error: 'contents 數量不正確' }
  }

  const contents: GeminiContentTurn[] = []
  for (const item of body.contents) {
    if (!isRecord(item)) return { ok: false, error: 'contents 格式不正確' }
    if (item.role !== 'user' && item.role !== 'model') {
      return { ok: false, error: '不支援的訊息角色' }
    }
    if (typeof item.text !== 'string' || !item.text.trim()) {
      return { ok: false, error: '訊息內容是空的' }
    }
    if (item.text.length > MAX_MESSAGE_CHARS) {
      return { ok: false, error: '訊息內容過長' }
    }
    contents.push({ role: item.role, text: item.text })
  }

  const temperature =
    typeof body.temperature === 'number' && Number.isFinite(body.temperature)
      ? Math.min(1, Math.max(0, body.temperature))
      : 0.6

  return {
    ok: true,
    systemInstruction: body.systemInstruction.trim(),
    contents,
    temperature,
  }
}

export async function proxyGeminiGenerate(
  body: unknown,
  env: GeminiProxyEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; body: { text?: string; error?: string } }> {
  if (!env.apiKey) {
    return {
      status: 500,
      body: {
        error:
          '伺服器尚未設定 GEMINI_API_KEY。本機請寫入 .env 後重啟開發伺服器；Vercel 請在專案環境變數設定後重新部署。',
      },
    }
  }

  const parsed = parseRequest(body)
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.model)}:generateContent`
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: parsed.systemInstruction }],
        },
        contents: parsed.contents.map((item) => ({
          role: item.role,
          parts: [{ text: item.text }],
        })),
        generationConfig: {
          temperature: parsed.temperature,
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
    })
  } catch {
    return { status: 502, body: { error: '無法連線 Gemini API' } }
  }

  let data: GeminiGenerateResponse
  try {
    data = (await response.json()) as GeminiGenerateResponse
  } catch {
    return {
      status: 502,
      body: { error: `Gemini API 回應無法解析（HTTP ${response.status}）` },
    }
  }

  if (!response.ok) {
    const apiMessage = data.error?.message
    if (response.status === 403) {
      return {
        status: 403,
        body: { error: apiMessage || 'API Key 無權限或未啟用 Gemini API（HTTP 403）' },
      }
    }
    if (response.status === 429) {
      return {
        status: 429,
        body: { error: apiMessage || '已達 Gemini API 配額或速率限制（HTTP 429）' },
      }
    }
    return {
      status: response.status,
      body: { error: apiMessage || `Gemini API 呼叫失敗（HTTP ${response.status}）` },
    }
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim()

  if (!text) {
    return { status: 502, body: { error: 'Gemini 未回傳可用的建議內容，請稍後再試' } }
  }

  return { status: 200, body: { text } }
}

function runtimeEnv(): Record<string, string | undefined> {
  const nodeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process
  return nodeProcess?.env ?? {}
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function handle(request: Request): Promise<Response> {
  try {
    const env = readGeminiEnv(runtimeEnv())
    if (request.method === 'GET') return json(geminiPublicStatus(env))
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return json({ error: '請求格式不正確' }, 400)
    }
    const result = await proxyGeminiGenerate(body, env)
    return json(result.body, result.status)
  } catch (error) {
    const message = error instanceof Error ? error.message : '伺服器錯誤'
    return json({ error: message }, 500)
  }
}

export function GET(request: Request) {
  return handle(request)
}

export function POST(request: Request) {
  return handle(request)
}

export default { fetch: handle }
