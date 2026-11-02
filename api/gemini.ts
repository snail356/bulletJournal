// 專案 package.json 是 "type": "module"。api/package.json 改回 commonjs，
// Vercel 才會把 ../server/geminiProxy 打包進函式；否則線上會在載入時崩潰。
import {
  geminiPublicStatus,
  proxyGeminiGenerate,
  readGeminiEnv,
} from '../server/geminiProxy'

export const config = {
  maxDuration: 60,
}

interface ApiRequest {
  method?: string
  body?: unknown
}

interface ApiResponse {
  status(code: number): { json(body: unknown): void }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const env = readGeminiEnv(process.env)
    if (req.method === 'GET') {
      res.status(200).json(geminiPublicStatus(env))
      return
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    let body: unknown
    try {
      body = req.body
    } catch {
      res.status(400).json({ error: '請求格式不正確' })
      return
    }
    const result = await proxyGeminiGenerate(body, env)
    res.status(result.status).json(result.body)
  } catch (error) {
    const message = error instanceof Error ? error.message : '伺服器錯誤'
    res.status(500).json({ error: message })
  }
}
