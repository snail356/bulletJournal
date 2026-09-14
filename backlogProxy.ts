import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'
import { isAllowedBacklogHost, isSafeBacklogApiPath } from './src/utils/backlogHost'

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? ''
  return value?.trim() ?? ''
}

async function handleBacklogProxy(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const host = headerValue(req.headers['x-backlog-host']).toLowerCase()
  const apiKey = headerValue(req.headers['x-backlog-api-key'])
  if (!isAllowedBacklogHost(host) || !apiKey) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Missing or invalid Backlog credentials' }))
    return
  }

  const incoming = new URL(req.url ?? '/', 'http://backlog.local')
  let pathname = incoming.pathname
  if (pathname === '/backlog-api' || pathname.startsWith('/backlog-api/')) {
    pathname = pathname.slice('/backlog-api'.length) || '/'
  }
  if (!isSafeBacklogApiPath(pathname)) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Invalid Backlog API path' }))
    return
  }

  const target = new URL(`/api/v2${pathname}${incoming.search}`, `https://${host}`)
  target.searchParams.set('apiKey', apiKey)

  const upstream = await fetch(target, {
    method: req.method,
    headers: { Accept: 'application/json' },
  })

  res.statusCode = upstream.status
  const contentType = upstream.headers.get('content-type')
  if (contentType) res.setHeader('Content-Type', contentType)
  const body = Buffer.from(await upstream.arrayBuffer())
  res.end(body)
}

const backlogProxyMiddleware: Connect.NextHandleFunction = (req, res, next) => {
  void handleBacklogProxy(req, res).catch(next)
}

function attachBacklogProxy(server: ViteDevServer | PreviewServer) {
  server.middlewares.use('/backlog-api', backlogProxyMiddleware)
}

export function backlogProxyPlugin(): Plugin {
  return {
    name: 'backlog-proxy',
    configureServer(server) {
      attachBacklogProxy(server)
    },
    configurePreviewServer(server) {
      attachBacklogProxy(server)
    },
  }
}
