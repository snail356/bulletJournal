import type { StatusItem, StatusSortOnSelect, TaskStatus } from '@/types'

export const COMPLETED_STATUS_ID = 'done'
export const DEFAULT_STATUS_ID = 'in_progress'

export const ALL_STATUSES = [
  'in_progress',
  'pending_test',
  'pending_fix',
  'waiting_pm',
  'waiting_release',
  'paused',
  'done',
] as const

export type DefaultTaskStatus = (typeof ALL_STATUSES)[number]

export const STATUS_LABELS: Record<DefaultTaskStatus, string> = {
  in_progress: '進行中',
  pending_test: '待測試',
  pending_fix: '待修正',
  waiting_pm: '待 PM 回覆',
  waiting_release: '待包版',
  paused: '暫停中',
  done: '已完成',
}

export const STATUS_COLORS: Record<DefaultTaskStatus, string> = {
  in_progress: '#7c3aed',
  pending_test: '#f97316',
  pending_fix: '#3b82f6',
  waiting_pm: '#eab308',
  waiting_release: '#06b6d4',
  paused: '#9ca3af',
  done: '#22c55e',
}

export const STATUS_BG: Record<DefaultTaskStatus, string> = {
  in_progress: '#ede9fe',
  pending_test: '#ffedd5',
  pending_fix: '#dbeafe',
  waiting_pm: '#fef9c3',
  waiting_release: '#cffafe',
  paused: '#f3f4f6',
  done: '#dcfce7',
}

export const STATUS_SORT_OPTIONS: { value: StatusSortOnSelect; label: string }[] = [
  { value: 'none', label: '不調整排序' },
  { value: 'top', label: '移至頂部' },
  { value: 'bottom', label: '移至底部（已完成之上）' },
]

export const STATUS_SORT_BACKUP_LABELS: Record<StatusSortOnSelect, string> = {
  none: '不調整',
  top: '至頂',
  bottom: '至底',
}

const DEFAULT_SORT_ON_SELECT: Partial<Record<DefaultTaskStatus, StatusSortOnSelect>> = {
  waiting_pm: 'bottom',
}

export function isCompletedStatus(id: TaskStatus): boolean {
  return id === COMPLETED_STATUS_ID
}

export function createDefaultStatusItems(): StatusItem[] {
  return ALL_STATUSES.map((id) => ({
    id,
    name: STATUS_LABELS[id],
    color: STATUS_COLORS[id],
    bgColor: STATUS_BG[id],
    sortOnSelect: DEFAULT_SORT_ON_SELECT[id] ?? 'none',
  }))
}

export function createUnknownStatusItem(id: TaskStatus): StatusItem {
  return {
    id,
    name: id,
    color: '#9ca3af',
    bgColor: '#f3f4f6',
    sortOnSelect: 'none',
  }
}

export function parseStatusSortOnSelect(
  value: unknown,
  id?: string,
): StatusSortOnSelect {
  if (value === 'top' || value === 'bottom' || value === 'none') return value
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
  if (raw === '至頂' || raw === '移至頂部' || raw === 'top') return 'top'
  if (
    raw === '至底' ||
    raw === '移至底部' ||
    raw === '移至底部（已完成之上）' ||
    raw === 'bottom'
  ) {
    return 'bottom'
  }
  if (id === 'waiting_pm') return 'bottom'
  return 'none'
}

export function normalizeStatusItems(items: StatusItem[] | null | undefined): StatusItem[] {
  if (!items?.length) return createDefaultStatusItems()

  const defaults = createDefaultStatusItems()
  const seen = new Set<string>()
  const ordered: StatusItem[] = []

  for (const item of items) {
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    const fallback = defaults.find((d) => d.id === id)
    const color = item.color || fallback?.color || '#9ca3af'
    ordered.push({
      id,
      name: (item.name || fallback?.name || id).trim() || id,
      color,
      bgColor: item.bgColor || getStatusBgForColor(color),
      sortOnSelect: parseStatusSortOnSelect(item.sortOnSelect, id),
    })
  }

  return ordered.length ? ordered : defaults
}

export function getStatusBgForColor(color: string): string {
  const match = ALL_STATUSES.find((id) => STATUS_COLORS[id] === color)
  return match ? STATUS_BG[match] : '#f3f4f6'
}

export function getBuiltinStatusName(id: string): string | undefined {
  return STATUS_LABELS[id as DefaultTaskStatus]
}

export const STATUS_COLOR_OPTIONS = ALL_STATUSES.map((id) => ({
  value: STATUS_COLORS[id],
  color: STATUS_COLORS[id],
}))
