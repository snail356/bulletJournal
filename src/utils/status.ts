import type { TaskStatus } from '@/types'

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
