import type { StatusItem, TaskStatus } from '@/types'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  in_progress: '進行中',
  pending_test: '待測試',
  pending_fix: '待修正',
  waiting_pm: '待 PM 回覆',
  waiting_release: '待包版',
  paused: '暫停中',
  done: '已完成',
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  in_progress: '#7c3aed',
  pending_test: '#f97316',
  pending_fix: '#3b82f6',
  waiting_pm: '#eab308',
  waiting_release: '#06b6d4',
  paused: '#9ca3af',
  done: '#22c55e',
}

export const STATUS_BG: Record<TaskStatus, string> = {
  in_progress: '#ede9fe',
  pending_test: '#ffedd5',
  pending_fix: '#dbeafe',
  waiting_pm: '#fef9c3',
  waiting_release: '#cffafe',
  paused: '#f3f4f6',
  done: '#dcfce7',
}

export const ALL_STATUSES: TaskStatus[] = [
  'in_progress',
  'pending_test',
  'pending_fix',
  'waiting_pm',
  'waiting_release',
  'paused',
  'done',
]

export function createDefaultStatusItems(): StatusItem[] {
  return ALL_STATUSES.map((id) => ({
    id,
    name: STATUS_LABELS[id],
    color: STATUS_COLORS[id],
    bgColor: STATUS_BG[id],
  }))
}

export function normalizeStatusItems(items: StatusItem[] | null | undefined): StatusItem[] {
  const defaults = createDefaultStatusItems()
  if (!items?.length) return defaults

  const ordered: StatusItem[] = []

  for (const item of items) {
    if (ALL_STATUSES.includes(item.id) && !ordered.some((o) => o.id === item.id)) {
      ordered.push({
        ...defaults.find((d) => d.id === item.id)!,
        ...item,
        id: item.id,
      })
    }
  }

  for (const def of defaults) {
    if (!ordered.some((item) => item.id === def.id)) {
      ordered.push(def)
    }
  }

  return ordered
}

export function getStatusBgForColor(color: string): string {
  const match = ALL_STATUSES.find((id) => STATUS_COLORS[id] === color)
  return match ? STATUS_BG[match] : '#f3f4f6'
}

export const STATUS_COLOR_OPTIONS = ALL_STATUSES.map((id) => ({
  value: STATUS_COLORS[id],
  color: STATUS_COLORS[id],
}))
