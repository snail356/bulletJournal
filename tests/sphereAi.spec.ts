import { describe, expect, it } from 'vitest'
import type { DailyReflection, Task } from '@/types'
import { createDefaultStatusItems } from '@/utils/status'
import {
  buildSphereAiContext,
  buildSphereConversation,
  SPHERE_AI_HISTORY_ROUNDS,
  SPHERE_AI_LIST_LIMIT,
} from '@/utils/sphereAi'

const statuses = createDefaultStatusItems()

function task(
  partial: Partial<Task> & Pick<Task, 'id' | 'date' | 'title' | 'completed'>,
): Task {
  return {
    endDate: null,
    avatarId: null,
    status: partial.completed ? 'done' : 'in_progress',
    statusHours: null,
    bodyContent: '',
    bodyContentType: 'text',
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

describe('buildSphereAiContext', () => {
  it('統計今日進度，未完成只含今天與逾期', () => {
    const context = buildSphereAiContext({
      today: '2026-10-30',
      statusItems: statuses,
      tasks: [
        task({
          id: 'today-open',
          date: '2026-10-30',
          title: '寫測試',
          completed: false,
          subtasks: [
            {
              id: 's1',
              taskId: 'today-open',
              title: '補案例',
              note: '',
              noteContentType: 'text',
              completed: false,
              attachments: [],
              createdAt: '',
              updatedAt: '',
            },
          ],
        }),
        task({
          id: 'today-done',
          date: '2026-10-30',
          title: '已完成項目',
          completed: true,
          status: 'done',
        }),
        task({
          id: 'overdue',
          date: '2026-10-28',
          title: '逾期代辦',
          completed: false,
        }),
        task({
          id: 'later',
          date: '2026-11-02',
          title: '之後代辦',
          completed: false,
        }),
        task({
          id: 'old-done',
          date: '2026-10-01',
          title: '早已完成',
          completed: true,
          status: 'done',
        }),
      ],
    })

    expect(context).toContain('今天日期：2026-10-30')
    expect(context).toContain('主任務：1/2（50%）')
    expect(context).toContain('含子任務：1/3（33%）')
    expect(context).toContain('未完成主任務：今日 1、逾期 1')
    expect(context).toContain('未完成子任務：1')
    expect(context).toContain('1. [未完成｜今天] 寫測試')
    expect(context).toContain('2. [已完成｜今天] 已完成項目')
    expect(context).toContain('1. [未完成｜逾期 2 天] 逾期代辦')
    expect(context).not.toContain('之後代辦')
    expect(context).not.toContain('早已完成')
    expect(context.indexOf('【今日任務】')).toBeLessThan(
      context.indexOf('逾期代辦'),
    )
  })

  it('主任務已完成時，未勾的子任務不計入未完成', () => {
    const context = buildSphereAiContext({
      today: '2026-10-30',
      statusItems: statuses,
      tasks: [
        task({
          id: 'done-open-sub',
          date: '2026-10-20',
          title: '收尾',
          completed: true,
          status: 'done',
          subtasks: [
            {
              id: 's2',
              taskId: 'done-open-sub',
              title: '補文件',
              note: '',
              noteContentType: 'text',
              completed: false,
              attachments: [],
              createdAt: '',
              updatedAt: '',
            },
          ],
        }),
      ],
    })

    expect(context).toContain('未完成主任務：今日 0、逾期 0')
    expect(context).toContain('未完成子任務：0')
    expect(context).not.toContain('收尾')
    expect(context).not.toContain('補文件')
  })

  it('今天已完成的主任務仍列出，其子任務不列成待辦', () => {
    const context = buildSphereAiContext({
      today: '2026-10-30',
      statusItems: statuses,
      tasks: [
        task({
          id: 'today-done-sub',
          date: '2026-10-30',
          title: '今天收尾',
          completed: true,
          status: 'done',
          subtasks: [
            {
              id: 's3',
              taskId: 'today-done-sub',
              title: '補文件',
              note: '',
              noteContentType: 'text',
              completed: false,
              attachments: [],
              createdAt: '',
              updatedAt: '',
            },
          ],
        }),
      ],
    })

    expect(context).toContain('主任務：1/1（100%）')
    expect(context).toContain('含子任務：2/2（100%）')
    expect(context).toContain('未完成子任務：0')
    expect(context).toContain('[已完成｜今天] 今天收尾')
    expect(context).not.toContain('補文件')
  })

  it('超出清單上限時保留總數並註明未列出的筆數', () => {
    const tasks = Array.from({ length: SPHERE_AI_LIST_LIMIT + 2 }, (_, index) =>
      task({
        id: `overdue-${index}`,
        date: '2026-10-01',
        title: `逾期項目 ${index}`,
        completed: false,
      }),
    )
    const context = buildSphereAiContext({
      today: '2026-10-30',
      statusItems: statuses,
      tasks,
    })

    expect(context).toContain(
      `未完成主任務：今日 0、逾期 ${SPHERE_AI_LIST_LIMIT + 2}`,
    )
    expect(context).toContain('…另有 2 項未列出')
    expect(context).not.toContain(`逾期項目 ${SPHERE_AI_LIST_LIMIT + 1}`)
  })

  it('附上今日回顧草稿', () => {
    const reflection: DailyReflection = {
      id: 'r1',
      date: '2026-10-30',
      morningContent: '先處理阻塞',
      afternoon1to3Content: '',
      afternoonAfter3Content: '',
      summaryContent: '',
      aiManagerAdvice: '',
      aiGeneratedAt: null,
      status: 'draft',
      createdAt: '',
      updatedAt: '',
    }
    const context = buildSphereAiContext({
      today: '2026-10-30',
      statusItems: statuses,
      tasks: [],
      reflection,
    })

    expect(context).toContain('狀態：草稿')
    expect(context).toContain('早上：先處理阻塞')
    expect(context).toContain('（今日無任務）')
    expect(context).toContain('（沒有逾期未完成代辦）')
  })
})

describe('buildSphereConversation', () => {
  it('只附上最近 6 輪，最新一問帶筆記本摘要', () => {
    const history = Array.from({ length: SPHERE_AI_HISTORY_ROUNDS + 2 }, (_, index) => ({
      question: `問題 ${index}`,
      answer: `回答 ${index}`,
    }))
    const messages = buildSphereConversation('新問題', '摘要內容', history)

    expect(messages).toHaveLength(SPHERE_AI_HISTORY_ROUNDS * 2 + 1)
    expect(messages[0]).toEqual({ role: 'user', text: '問題 2' })
    expect(messages.at(-2)).toEqual({
      role: 'model',
      text: `回答 ${SPHERE_AI_HISTORY_ROUNDS + 1}`,
    })
    expect(messages.at(-1)?.text).toContain('【筆記本資料】\n摘要內容')
    expect(messages.at(-1)?.text).toContain('【問題】\n新問題')
    expect(messages.some((item) => item.text === '問題 0')).toBe(false)
  })
})
