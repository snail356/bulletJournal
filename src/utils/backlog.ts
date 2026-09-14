import {
  BACKLOG_PREFS_KEY,
  loadFromStorage,
  removeFromStorage,
  saveToStorage,
} from '@/utils/storage'
import {
  buildBacklogIssueUrl,
  parseSpaceUrl,
  type BacklogSpace,
} from '@/utils/backlogHost'

export interface BacklogPrefs {
  spaceUrl: string
  apiKey: string
}

export interface BacklogUser {
  id: number
  userId: string
  name: string
}

export interface BacklogProject {
  id: number
  projectKey: string
  name: string
  archived: boolean
}

/** 匯入頁僅顯示這些專案（比對 name 或 projectKey，不分大小寫） */
export const BACKLOG_ALLOWED_PROJECTS = [
  'matrix',
  'bpm',
  '稽核系統',
  'TOPSales',
  '自動化測試',
  'Solution',
  'R&D Team',
  'NUP',
] as const

/** 不列入 milestone 篩選的專案（比對 name 或 projectKey，不分大小寫） */
export const BACKLOG_EXCLUDED_MILESTONE_PROJECTS = ['TSS'] as const

export interface BacklogStatus {
  id: number
  name: string
  color?: string
  displayOrder?: number
}

export interface BacklogMilestone {
  id: number
  projectId: number
  name: string
  archived: boolean
  displayOrder?: number
}

export interface BacklogIssue {
  id: number
  issueKey: string
  summary: string
  description: string | null
  dueDate: string | null
  startDate?: string | null
  projectId: number
  status: {
    id: number
    name: string
  }
  milestone?: Array<{
    id: number
    name: string
    projectId?: number
  }>
}

export interface BacklogCreateTaskPayload {
  date: string
  title: string
  endDate: string | null
  backlogIssueId: number
  backlogIssueKey: string
  backlogUrl: string
}

export class BacklogApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'BacklogApiError'
    this.status = status
  }
}

const emptyPrefs: BacklogPrefs = { spaceUrl: '', apiKey: '' }

export function loadBacklogPrefs(): BacklogPrefs {
  const raw = loadFromStorage<Partial<BacklogPrefs>>(BACKLOG_PREFS_KEY, emptyPrefs)
  return {
    spaceUrl: typeof raw.spaceUrl === 'string' ? raw.spaceUrl : '',
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
  }
}

export function saveBacklogPrefs(prefs: BacklogPrefs): void {
  saveToStorage(BACKLOG_PREFS_KEY, {
    spaceUrl: prefs.spaceUrl.trim(),
    apiKey: prefs.apiKey.trim(),
  })
}

export function clearBacklogPrefs(): void {
  removeFromStorage(BACKLOG_PREFS_KEY)
}

export function hasBacklogCredentials(prefs = loadBacklogPrefs()): boolean {
  return Boolean(parseSpaceUrl(prefs.spaceUrl) && prefs.apiKey.trim())
}

export function normalizeBacklogLink(task: {
  backlogIssueId?: number | null
  backlogIssueKey?: string | null
  backlogUrl?: string | null
}): {
  backlogIssueId: number | null
  backlogIssueKey: string | null
  backlogUrl: string | null
} {
  return {
    backlogIssueId: typeof task.backlogIssueId === 'number' ? task.backlogIssueId : null,
    backlogIssueKey: task.backlogIssueKey?.trim() ? task.backlogIssueKey : null,
    backlogUrl: task.backlogUrl?.trim() ? task.backlogUrl : null,
  }
}

export function backlogDateToYmd(value: string | null | undefined): string | null {
  if (!value) return null
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value)
  return match?.[1] ?? null
}

export function isBacklogIssueClosed(issue: Pick<BacklogIssue, 'status'>): boolean {
  const name = issue.status?.name ?? ''
  return /完了|完成|クローズ|closed|done/i.test(name)
}

function normalizeProjectLabel(value: string): string {
  return value.trim().toLowerCase()
}

const allowedProjectLabels = new Set(
  BACKLOG_ALLOWED_PROJECTS.map((label) => normalizeProjectLabel(label)),
)

const excludedMilestoneProjectLabels = new Set(
  BACKLOG_EXCLUDED_MILESTONE_PROJECTS.map((label) => normalizeProjectLabel(label)),
)

export function isAllowedBacklogProject(project: Pick<BacklogProject, 'name' | 'projectKey'>): boolean {
  return (
    allowedProjectLabels.has(normalizeProjectLabel(project.name)) ||
    allowedProjectLabels.has(normalizeProjectLabel(project.projectKey))
  )
}

export function isBacklogMilestoneProjectExcluded(
  project: Pick<BacklogProject, 'name' | 'projectKey'>,
): boolean {
  return (
    excludedMilestoneProjectLabels.has(normalizeProjectLabel(project.name)) ||
    excludedMilestoneProjectLabels.has(normalizeProjectLabel(project.projectKey))
  )
}

export function filterAllowedBacklogProjects(projects: BacklogProject[]): BacklogProject[] {
  return projects.filter(isAllowedBacklogProject)
}

export function filterMilestoneSourceProjects(projects: BacklogProject[]): BacklogProject[] {
  return projects.filter((project) => !isBacklogMilestoneProjectExcluded(project))
}

export function mapBacklogIssueToCreatePayload(
  issue: BacklogIssue,
  date: string,
  spaceOrigin: string,
): BacklogCreateTaskPayload {
  return {
    date,
    title: `${issue.issueKey} ${issue.summary}`.trim(),
    endDate: backlogDateToYmd(issue.dueDate),
    backlogIssueId: issue.id,
    backlogIssueKey: issue.issueKey,
    backlogUrl: buildBacklogIssueUrl(spaceOrigin, issue.issueKey),
  }
}

export function partitionBacklogIssues<T extends { id: number }>(
  issues: T[],
  importedIds: Iterable<number>,
): { fresh: T[]; skipped: T[] } {
  const imported = new Set(importedIds)
  const fresh: T[] = []
  const skipped: T[] = []
  for (const issue of issues) {
    if (imported.has(issue.id)) skipped.push(issue)
    else fresh.push(issue)
  }
  return { fresh, skipped }
}

export function openBacklogUrl(url: string): void {
  const trimmed = url.trim()
  if (!trimmed) return
  window.open(trimmed, '_blank', 'noopener,noreferrer')
}

export function formatBacklogError(error: unknown): string {
  if (error instanceof BacklogApiError) {
    if (error.status === 401 || error.status === 403) {
      return 'API Key 無效或權限不足'
    }
    if (error.status === 404) {
      return '找不到 Backlog API。請以本機 npm run dev 執行（靜態站無法直連）。'
    }
    if (error.status === 0) {
      return '無法連線到 Backlog 代理，請確認以本機開發伺服器執行。'
    }
    return error.message || `Backlog API 錯誤（${error.status}）`
  }
  if (error instanceof TypeError) {
    return '無法連線到 Backlog 代理，請確認以本機開發伺服器執行。'
  }
  return error instanceof Error ? error.message : '載入 Backlog 失敗'
}

type QueryValue = string | number | boolean | Array<string | number>

async function backlogGet<T>(
  path: string,
  query?: Record<string, QueryValue | undefined>,
): Promise<T> {
  const prefs = loadBacklogPrefs()
  const space = parseSpaceUrl(prefs.spaceUrl)
  if (!space || !prefs.apiKey.trim()) {
    throw new BacklogApiError('尚未設定 Space 或 API Key', 400)
  }

  const url = new URL(`/backlog-api${path}`, window.location.origin)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value == null) continue
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item))
      } else {
        url.searchParams.set(key, String(value))
      }
    }
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Backlog-Host': space.host,
        'X-Backlog-Api-Key': prefs.apiKey.trim(),
      },
    })
  } catch {
    throw new BacklogApiError('無法連線到 Backlog 代理，請確認以本機開發伺服器執行。', 0)
  }

  if (!response.ok) {
    throw new BacklogApiError(await readErrorMessage(response), response.status)
  }

  return (await response.json()) as T
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: string
      errors?: Array<{ message?: string }>
      message?: string
    }
    const fromList = data.errors?.map((item) => item.message).filter(Boolean).join('；')
    return fromList || data.error || data.message || `Backlog API 錯誤（${response.status}）`
  } catch {
    return `Backlog API 錯誤（${response.status}）`
  }
}

export function getConfiguredSpace(): BacklogSpace | null {
  return parseSpaceUrl(loadBacklogPrefs().spaceUrl)
}

export function fetchBacklogMyself() {
  return backlogGet<BacklogUser>('/users/myself')
}

export function fetchBacklogProjects() {
  return backlogGet<BacklogProject[]>('/projects', { archived: false })
}

export function fetchBacklogProjectStatuses(projectId: number) {
  return backlogGet<BacklogStatus[]>(`/projects/${projectId}/statuses`)
}

export async function fetchBacklogProjectMilestones(projectId: number) {
  const versions = await backlogGet<BacklogMilestone[]>(`/projects/${projectId}/versions`)
  return versions.filter((item) => !item.archived)
}

export function issueMilestoneLabel(issue: Pick<BacklogIssue, 'milestone'>): string {
  const names = (issue.milestone ?? []).map((item) => item.name.trim()).filter(Boolean)
  return names.length ? names.join('、') : '—'
}

export function fetchBacklogIssues(params: {
  assigneeId: number
  projectId?: number
  projectIds?: number[]
  statusId?: number
  milestoneId?: number
  offset?: number
  count?: number
}) {
  const query: Record<string, QueryValue | undefined> = {
    'assigneeId[]': [params.assigneeId],
    count: params.count ?? 100,
    offset: params.offset ?? 0,
    sort: 'updated',
    order: 'desc',
  }
  if (params.projectId != null) query['projectId[]'] = [params.projectId]
  else if (params.projectIds?.length) query['projectId[]'] = params.projectIds
  if (params.statusId != null) query['statusId[]'] = [params.statusId]
  if (params.milestoneId != null) query['milestoneId[]'] = [params.milestoneId]
  return backlogGet<BacklogIssue[]>('/issues', query)
}
