import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyReflection, StatusItem, SubTask, Task } from '@/types'
import {
  askJournalQuestion,
  generateAiManagerAdvice,
  normalizeAiAdviceText,
} from '@/utils/gemini'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function reflection(partial: Partial<DailyReflection> = {}): DailyReflection {
  return {
    id: 'r1',
    date: '2026-11-03',
    morningContent: '',
    afternoon1to3Content: '',
    afternoonAfter3Content: '',
    summaryContent: '',
    aiManagerAdvice: '',
    aiGeneratedAt: null,
    status: 'draft',
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

function subtask(partial: Partial<SubTask> & Pick<SubTask, 'id' | 'title'>): SubTask {
  return {
    taskId: 't1',
    note: '',
    noteContentType: 'text',
    completed: false,
    attachments: [],
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

function task(partial: Partial<Task> = {}): Task {
  return {
    id: 't1',
    date: '2026-11-03',
    endDate: null,
    title: '寫測試',
    avatarId: null,
    status: 'in_progress',
    statusHours: null,
    bodyContent: '',
    bodyContentType: 'text',
    completed: false,
    subtasks: [],
    notes: [],
    attachments: [],
    labels: [],
    migrationHistory: [],
    backlogIssueId: null,
    backlogIssueKey: null,
    backlogUrl: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

const statuses: StatusItem[] = [
  {
    id: 'in_progress',
    name: '進行中',
    color: '#7c3aed',
    bgColor: '#ede9fe',
    sortOnSelect: 'none',
  },
]

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('normalizeAiAdviceText', () => {
  it('清掉 NBSP、行尾空白與過多空行', () => {
    expect(normalizeAiAdviceText('總評\u00a0  \n\n\n\n建議  \n')).toBe(
      '總評\n\n建議',
    )
  })
})

describe('loadGeminiServerStatus', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('成功時回傳 configured 與修剪後的模型名稱，並快取同一請求', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ configured: true, model: ' gemini-custom ' }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { loadGeminiServerStatus } = await import('@/utils/gemini')

    await expect(loadGeminiServerStatus()).resolves.toEqual({
      configured: true,
      model: 'gemini-custom',
    })
    await loadGeminiServerStatus()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/gemini')
  })

  it('HTTP 失敗時用預設狀態', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ configured: true }, 500)),
    )
    const { loadGeminiServerStatus } = await import('@/utils/gemini')
    await expect(loadGeminiServerStatus()).resolves.toEqual({
      configured: false,
      model: 'gemini-3.5-flash',
    })
  })

  it('configured 非 true 或模型無效時用預設模型', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ configured: 'yes', model: '   ' })),
    )
    const { loadGeminiServerStatus } = await import('@/utils/gemini')
    await expect(loadGeminiServerStatus()).resolves.toEqual({
      configured: false,
      model: 'gemini-3.5-flash',
    })
  })

  it('網路錯誤時不丟出，改回預設', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    const { loadGeminiServerStatus } = await import('@/utils/gemini')
    await expect(loadGeminiServerStatus()).resolves.toEqual({
      configured: false,
      model: 'gemini-3.5-flash',
    })
  })
})

describe('generateAiManagerAdvice', () => {
  it('把回顧、自訂 Prompt 與任務摘要送到 /api/gemini', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ text: '  建議內容  ' }))
    vi.stubGlobal('fetch', fetchMock)

    const dayTasks = [
      task({
        title: '',
        completed: true,
        status: 'unknown-status',
        statusHours: 1.5,
        bodyContent: '  已修好登入  ',
        subtasks: [
          ...Array.from({ length: 8 }, (_, index) =>
            subtask({
              id: `s${index}`,
              title: index === 0 ? '' : `子${index}`,
              completed: index === 0,
              note: index === 0 ? '這段備註會被截短'.repeat(20) : '',
            }),
          ),
          subtask({ id: 's8', title: '不會完整列出' }),
        ],
      }),
    ]

    await expect(
      generateAiManagerAdvice(
        reflection({ morningContent: '晨會' }),
        '  請更具體  ',
        dayTasks,
        statuses,
      ),
    ).resolves.toBe('建議內容')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(fetchMock.mock.calls[0][0]).toBe('/api/gemini')
    const body = JSON.parse(String(init.body)) as {
      temperature: number
      contents: Array<{ text: string }>
    }
    expect(body.temperature).toBe(0.6)
    expect(body.contents[0].text).toContain('【使用者自訂 Prompt】')
    expect(body.contents[0].text).toContain('請更具體')
    expect(body.contents[0].text).toContain('（無標題）')
    expect(body.contents[0].text).toContain('狀態：unknown-status')
    expect(body.contents[0].text).toContain('時數：1.5h')
    expect(body.contents[0].text).toContain('另有 1 項子任務')
    expect(body.contents[0].text).toContain('【早上】\n晨會')
    expect(body.contents[0].text).toContain('（未填寫）')
  })

  it('當日無任務時在 prompt 註明', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ text: '空日建議' }))
    vi.stubGlobal('fetch', fetchMock)
    await generateAiManagerAdvice(reflection())
    const body = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    ) as { contents: Array<{ text: string }> }
    expect(body.contents[0].text).toContain('（當日無任務）')
    expect(body.contents[0].text).not.toContain('【使用者自訂 Prompt】')
  })

  it('HTTP 錯誤時丟出伺服器訊息', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: '配額用完' }, 429)),
    )
    await expect(generateAiManagerAdvice(reflection())).rejects.toThrow('配額用完')
  })

  it('回應不是 JSON 時用 HTTP 狀態當錯誤', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('oops', { status: 502 })),
    )
    await expect(generateAiManagerAdvice(reflection())).rejects.toThrow(
      'Gemini 呼叫失敗（HTTP 502）',
    )
  })

  it('成功但沒有可用文字時丟出錯誤', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ text: '   ' })))
    await expect(generateAiManagerAdvice(reflection())).rejects.toThrow(
      'Gemini 未回傳可用的建議內容，請稍後再試',
    )
  })
})

describe('askJournalQuestion', () => {
  it('空白問題直接拒絕，不呼叫 API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(askJournalQuestion('   ', '摘要')).rejects.toThrow('請先輸入問題')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('把筆記本摘要與近期對話送到 API', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ text: '還有兩件逾期' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      askJournalQuestion('未完成有哪些？', '今日 1 件逾期', [
        { question: '昨天呢', answer: '已清完' },
      ]),
    ).resolves.toBe('還有兩件逾期')

    const body = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    ) as {
      temperature: number
      contents: Array<{ role: string; text: string }>
    }
    expect(body.temperature).toBe(0.4)
    expect(body.contents[0]).toEqual({ role: 'user', text: '昨天呢' })
    expect(body.contents[1]).toEqual({ role: 'model', text: '已清完' })
    expect(body.contents.at(-1)?.text).toContain('【筆記本資料】')
    expect(body.contents.at(-1)?.text).toContain('未完成有哪些？')
  })
})
