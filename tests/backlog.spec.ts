import { describe, expect, it } from 'vitest'
import {
  backlogDateToYmd,
  isBacklogIssueClosed,
  issueMilestoneLabel,
  mapBacklogIssueToCreatePayload,
  normalizeBacklogLink,
  partitionBacklogIssues,
  filterAllowedBacklogProjects,
  isAllowedBacklogProject,
  isBacklogMilestoneProjectExcluded,
  filterMilestoneSourceProjects,
  type BacklogIssue,
} from '@/utils/backlog'
import {
  buildBacklogIssueUrl,
  isAllowedBacklogHost,
  isSafeBacklogApiPath,
  parseSpaceUrl,
} from '@/utils/backlogHost'
import { defaultNavFeatureVisibility } from '@/utils/navFeatures'
import { normalizeTask } from '@/stores/taskStore'
import type { Task } from '@/types'

function issue(partial: Partial<BacklogIssue> & Pick<BacklogIssue, 'id' | 'issueKey' | 'summary'>): BacklogIssue {
  return {
    description: null,
    dueDate: null,
    projectId: 1,
    status: { id: 1, name: '處理中' },
    ...partial,
  }
}

describe('Backlog host whitelist', () => {
  it('允許 backlog.com / jp / backlogtool.com 子網域', () => {
    expect(isAllowedBacklogHost('my-space.backlog.com')).toBe(true)
    expect(isAllowedBacklogHost('team.backlog.jp')).toBe(true)
    expect(isAllowedBacklogHost('acme.backlogtool.com')).toBe(true)
  })

  it('拒絕非 Backlog 網域與夾帶路徑', () => {
    expect(isAllowedBacklogHost('evil.com')).toBe(false)
    expect(isAllowedBacklogHost('my-space.backlog.com.evil.com')).toBe(false)
    expect(isAllowedBacklogHost('backlog.com')).toBe(false)
    expect(isAllowedBacklogHost('my-space.backlog.com:443')).toBe(false)
    expect(isAllowedBacklogHost('my-space.backlog.com/api')).toBe(false)
  })

  it('解析 Space URL 並組成 https origin', () => {
    expect(parseSpaceUrl('https://my-space.backlog.com/projects/FOO')).toEqual({
      host: 'my-space.backlog.com',
      origin: 'https://my-space.backlog.com',
    })
    expect(parseSpaceUrl('my-space.backlog.jp')).toEqual({
      host: 'my-space.backlog.jp',
      origin: 'https://my-space.backlog.jp',
    })
    expect(parseSpaceUrl('https://example.com')).toBeNull()
  })

  it('只轉發安全的 API path', () => {
    expect(isSafeBacklogApiPath('/issues')).toBe(true)
    expect(isSafeBacklogApiPath('/users/myself')).toBe(true)
    expect(isSafeBacklogApiPath('/projects/12/statuses')).toBe(true)
    expect(isSafeBacklogApiPath('/../etc/passwd')).toBe(false)
    expect(isSafeBacklogApiPath('/issues?x=1')).toBe(false)
  })
})

describe('Backlog issue mapping', () => {
  it('組出 view URL 與主任務標題', () => {
    const payload = mapBacklogIssueToCreatePayload(
      issue({
        id: 42,
        issueKey: 'PROJ-123',
        summary: '修正登入',
        description: '**步驟**',
        dueDate: '2026-09-20T00:00:00Z',
      }),
      '2026-09-14',
      'https://my-space.backlog.com',
    )
    expect(payload.title).toBe('PROJ-123 修正登入')
    expect(payload.date).toBe('2026-09-14')
    expect(payload.endDate).toBe('2026-09-20')
    expect(payload).not.toHaveProperty('bodyContent')
    expect(payload.backlogIssueId).toBe(42)
    expect(payload.backlogIssueKey).toBe('PROJ-123')
    expect(payload.backlogUrl).toBe('https://my-space.backlog.com/view/PROJ-123')
    expect(buildBacklogIssueUrl('https://my-space.backlog.com/', 'PROJ-123')).toBe(
      'https://my-space.backlog.com/view/PROJ-123',
    )
  })

  it('去重已匯入的 issue', () => {
    const { fresh, skipped } = partitionBacklogIssues(
      [issue({ id: 1, issueKey: 'A-1', summary: 'a' }), issue({ id: 2, issueKey: 'A-2', summary: 'b' })],
      [1],
    )
    expect(fresh.map((item) => item.id)).toEqual([2])
    expect(skipped.map((item) => item.id)).toEqual([1])
  })

  it('辨識已完成狀態', () => {
    expect(isBacklogIssueClosed(issue({ id: 1, issueKey: 'A-1', summary: 'a', status: { id: 4, name: '完了' } }))).toBe(
      true,
    )
    expect(isBacklogIssueClosed(issue({ id: 1, issueKey: 'A-1', summary: 'a', status: { id: 2, name: '處理中' } }))).toBe(
      false,
    )
  })

  it('僅保留指定專案名稱／Key', () => {
    const filtered = filterAllowedBacklogProjects([
      { id: 1, projectKey: 'MATRIX', name: 'matrix', archived: false },
      { id: 2, projectKey: 'OTHER', name: '雜項', archived: false },
      { id: 3, projectKey: 'NUP', name: 'NUP 專案', archived: false },
      { id: 4, projectKey: 'RND', name: 'R&D Team', archived: false },
    ])
    expect(filtered.map((item) => item.id)).toEqual([1, 3, 4])
    expect(isAllowedBacklogProject({ name: '稽核系統', projectKey: 'AUDIT' })).toBe(true)
    expect(isAllowedBacklogProject({ name: '其他', projectKey: 'ZZZ' })).toBe(false)
  })

  it('排除 TSS 專案的 milestone', () => {
    const tss = { id: 9, projectKey: 'TSS', name: '自動化測試', archived: false }
    const nup = { id: 4, projectKey: 'NUP', name: 'NUP', archived: false }
    expect(isBacklogMilestoneProjectExcluded(tss)).toBe(true)
    expect(isBacklogMilestoneProjectExcluded(nup)).toBe(false)
    expect(filterMilestoneSourceProjects([tss, nup]).map((item) => item.id)).toEqual([4])
  })

  it('日期字串取 YYYY-MM-DD', () => {
    expect(backlogDateToYmd('2026-09-01T15:00:00Z')).toBe('2026-09-01')
    expect(backlogDateToYmd(null)).toBeNull()
  })

  it('組出 milestone 顯示名稱', () => {
    expect(issueMilestoneLabel({ milestone: [{ id: 1, name: 'Sprint 12' }] })).toBe('Sprint 12')
    expect(issueMilestoneLabel({ milestone: [] })).toBe('—')
  })
})

describe('舊任務相容', () => {
  it('Backlog 功能預設關閉', () => {
    expect(defaultNavFeatureVisibility.backlog).toBe(false)
  })

  it('缺少 Backlog 欄位時補 null', () => {
    expect(normalizeBacklogLink({})).toEqual({
      backlogIssueId: null,
      backlogIssueKey: null,
      backlogUrl: null,
    })
  })

  it('normalizeTask 不破壞舊資料並補上 Backlog 欄位', () => {
    const legacy = {
      id: 't1',
      date: '2026-09-14',
      endDate: null,
      title: '舊任務',
      avatarId: null,
      status: 'in_progress',
      statusHours: null,
      bodyContent: '',
      bodyContentType: 'text' as const,
      completed: false,
      subtasks: [],
      notes: [],
      attachments: [],
      labels: [],
      migrationHistory: [],
      createdAt: '2026-09-14T00:00:00.000Z',
      updatedAt: '2026-09-14T00:00:00.000Z',
    } as unknown as Task
    const normalized = normalizeTask(legacy)
    expect(normalized.title).toBe('舊任務')
    expect(normalized.backlogIssueId).toBeNull()
    expect(normalized.backlogIssueKey).toBeNull()
    expect(normalized.backlogUrl).toBeNull()
  })
})
