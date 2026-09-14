const ALLOWED_HOST_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.(backlog\.com|backlog\.jp|backlogtool\.com)$/

export interface BacklogSpace {
  host: string
  origin: string
}

export function isAllowedBacklogHost(host: string): boolean {
  const normalized = host.trim().toLowerCase()
  if (!normalized) return false
  if (normalized.includes('/') || normalized.includes(':') || normalized.includes(' ')) {
    return false
  }
  return ALLOWED_HOST_PATTERN.test(normalized)
}

export function parseSpaceUrl(input: string): BacklogSpace | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    const host = url.hostname.toLowerCase()
    if (!isAllowedBacklogHost(host)) return null
    return { host, origin: `https://${host}` }
  } catch {
    return null
  }
}

export function buildBacklogIssueUrl(spaceOrigin: string, issueKey: string): string {
  const origin = spaceOrigin.replace(/\/$/, '')
  return `${origin}/view/${issueKey}`
}

export function isSafeBacklogApiPath(pathname: string): boolean {
  return /^\/[A-Za-z0-9/_-]*$/.test(pathname)
}
