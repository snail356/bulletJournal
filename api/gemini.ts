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
  const env = readGeminiEnv(process.env)
  if (req.method === 'GET') {
    res.status(200).json(geminiPublicStatus(env))
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const result = await proxyGeminiGenerate(req.body, env)
  res.status(result.status).json(result.body)
}
