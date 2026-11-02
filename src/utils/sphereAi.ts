import type { DailyReflection, StatusItem, Task } from '@/types'
import {
  daysBetween,
  formatDateRange,
  getTaskEndDate,
  taskOverlapsDate,
} from '@/utils/date'

export const SPHERE_AI_QUESTION_LIMIT = 1000
export const SPHERE_AI_LIST_LIMIT = 40

export const SPHERE_AI_QUESTIONS = [
  {
    key: 'progress',
    label: '今日進度',
    question: '今天的任務進度如何？已完成與還沒做完的分別是什麼？',
  },
  {
    key: 'todos',
    label: '未完成代辦',
    question: '目前還有哪些未完成代辦？請分成逾期與今天來說明。',
  },
  {
    key: 'next',
    label: '先做什麼',
    question: '依今天的進度與未完成代辦，接下來最該先處理的三件事是什麼？',
  },
] as const

export interface SphereAiContextInput {
  today: string
  tasks: Task[]
  statusItems: StatusItem[]
  reflection?: DailyReflection | null
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed
}

function statusName(task: Task, statusItems: StatusItem[]): string {
  return statusItems.find((item) => item.id === task.status)?.name ?? task.status
}

function openSubtaskCount(task: Task): number {
  if (task.completed) return 0
  return task.subtasks.filter((sub) => !sub.completed).length
}

/** 主任務已完成時，子任務整筆視為完成，避免拉低進度 */
function doneSubtaskCount(task: Task): number {
  if (task.completed) return task.subtasks.length
  return task.subtasks.filter((sub) => sub.completed).length
}

function formatTaskBlock(
  task: Task,
  index: number,
  today: string,
  statusItems: StatusItem[],
): string {
  const end = getTaskEndDate(task)
  const timing =
    end < today
      ? `逾期 ${daysBetween(end, today)} 天`
      : task.date > today
        ? '之後'
        : '今天'
  const lines = [
    `${index}. [${task.completed ? '已完成' : '未完成'}｜${timing}] ${task.title || '（無標題）'}`,
    `   日期：${formatDateRange(task)}｜狀態：${statusName(task, statusItems)}` +
      (task.statusHours != null ? `｜時數：${task.statusHours}h` : ''),
  ]
  if (task.bodyContent.trim()) {
    lines.push(`   內容：${truncate(task.bodyContent, 180)}`)
  }
  if (!task.completed && task.subtasks.length > 0) {
    const done = task.subtasks.filter((sub) => sub.completed).length
    lines.push(`   子任務：${done}/${task.subtasks.length} 完成`)
    for (const sub of task.subtasks.slice(0, 6)) {
      lines.push(
        `   - [${sub.completed ? 'x' : ' '}] ${sub.title || '（無標題）'}` +
          (sub.note.trim() ? `（${truncate(sub.note, 60)}）` : ''),
      )
    }
    if (task.subtasks.length > 6) {
      lines.push(`   - …另有 ${task.subtasks.length - 6} 項子任務`)
    }
  }
  return lines.join('\n')
}

function formatTaskList(
  tasks: Task[],
  today: string,
  statusItems: StatusItem[],
  emptyLabel: string,
): string {
  if (!tasks.length) return emptyLabel
  const visible = tasks.slice(0, SPHERE_AI_LIST_LIMIT)
  const blocks = visible.map((task, index) =>
    formatTaskBlock(task, index + 1, today, statusItems),
  )
  if (tasks.length > visible.length) {
    blocks.push(`…另有 ${tasks.length - visible.length} 項未列出`)
  }
  return blocks.join('\n\n')
}

function progressLine(done: number, total: number): string {
  const percentage = total === 0 ? 0 : Math.round((done / total) * 100)
  return `${done}/${total}（${percentage}%）`
}

function formatReflection(reflection: DailyReflection | null | undefined): string {
  if (!reflection) return '（今日尚無回顧）'
  const section = (label: string, text: string) =>
    `${label}：${truncate(text, 160) || '（未填寫）'}`
  const status = reflection.status === 'submitted' ? '已提交' : '草稿'
  return [
    `狀態：${status}`,
    section('早上', reflection.morningContent),
    section('下午1點-3點', reflection.afternoon1to3Content),
    section('下午3點後', reflection.afternoonAfter3Content),
    section('當日總結', reflection.summaryContent),
  ].join('\n')
}

/** 給光球提問用的筆記本摘要：今日進度、今日任務、逾期未完成、今日回顧 */
export function buildSphereAiContext(input: SphereAiContextInput): string {
  const { today, tasks, statusItems } = input
  const todayTasks = tasks.filter((task) => taskOverlapsDate(task, today))
  const overdue = tasks
    .filter((task) => !task.completed && getTaskEndDate(task) < today)
    .sort((a, b) => getTaskEndDate(a).localeCompare(getTaskEndDate(b)))

  let todayTaskDone = 0
  let todaySubTotal = 0
  let todaySubDone = 0
  for (const task of todayTasks) {
    if (task.completed) todayTaskDone += 1
    todaySubTotal += task.subtasks.length
    todaySubDone += doneSubtaskCount(task)
  }
  const todayOpenTasks = todayTasks.filter((task) => !task.completed).length
  const openSubtasks = [...todayTasks, ...overdue].reduce(
    (sum, task) => sum + openSubtaskCount(task),
    0,
  )

  return [
    `今天日期：${today}`,
    '',
    '【今日進度】',
    `主任務：${progressLine(todayTaskDone, todayTasks.length)}`,
    `含子任務：${progressLine(todayTaskDone + todaySubDone, todayTasks.length + todaySubTotal)}`,
    `未完成主任務：今日 ${todayOpenTasks}、逾期 ${overdue.length}`,
    `未完成子任務：${openSubtasks}`,
    '主任務已完成時，其子任務整筆視為完成，不計入未完成。',
    '',
    '【今日任務】',
    formatTaskList(todayTasks, today, statusItems, '（今日無任務）'),
    '',
    '【逾期未完成代辦】',
    '不含今天已列出的任務。只含結束日早於今天、且主任務尚未完成者。開始日在今天之後的任務不列入。',
    formatTaskList(overdue, today, statusItems, '（沒有逾期未完成代辦）'),
    '',
    '【今日回顧】',
    formatReflection(input.reflection),
  ].join('\n')
}

export const SPHERE_AI_HISTORY_ROUNDS = 6

export interface SphereAiTurn {
  question: string
  answer: string
}

export interface SphereAiMessage {
  role: 'user' | 'model'
  text: string
}

/** 最近幾輪純問答，再加上帶有最新摘要的這一問 */
export function buildSphereConversation(
  question: string,
  context: string,
  history: SphereAiTurn[],
): SphereAiMessage[] {
  const recent = history
    .filter((turn) => turn.question.trim() && turn.answer.trim())
    .slice(-SPHERE_AI_HISTORY_ROUNDS)
  const messages: SphereAiMessage[] = []
  for (const turn of recent) {
    messages.push({ role: 'user', text: turn.question.trim() })
    messages.push({ role: 'model', text: turn.answer.trim() })
  }
  messages.push({
    role: 'user',
    text: `【筆記本資料】\n${context}\n\n【問題】\n${question.trim()}`,
  })
  return messages
}
