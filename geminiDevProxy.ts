import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Connect, type Plugin, type PreviewServer, type ViteDevServer } from 'vite'
import { geminiPublicStatus, proxyGeminiGenerate, readGeminiEnv } from './server/geminiProxy'

const MAX_BODY_BYTES = 512_000

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buf.length
    if (size > MAX_BODY_BYTES) {
      const error = new Error('payload too large')
      error.name = 'PayloadTooLarge'
      throw error
    }
    chunks.push(buf)
  }
  if (size === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function attachGeminiProxy(server: ViteDevServer | PreviewServer) {
  const mode = server.config.mode
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const env = readGeminiEnv(loadEnv(mode, server.config.root, ''))
    if (req.method === 'GET') {
      sendJson(res, 200, geminiPublicStatus(env))
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }
    void readJsonBody(req)
      .then((body) => proxyGeminiGenerate(body, env))
      .then((result) => sendJson(res, result.status, result.body))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'PayloadTooLarge') {
          sendJson(res, 413, { error: '請求內容過大' })
          return
        }
        if (error instanceof SyntaxError) {
          sendJson(res, 400, { error: '請求格式不正確' })
          return
        }
        next(error)
      })
  }
  server.middlewares.use('/api/gemini', middleware)
}

export function geminiDevProxyPlugin(): Plugin {
  return {
    name: 'gemini-dev-proxy',
    configureServer(server) {
      attachGeminiProxy(server)
    },
    configurePreviewServer(server) {
      attachGeminiProxy(server)
    },
  }
}
