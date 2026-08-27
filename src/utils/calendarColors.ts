import type { Label, StatusItem, Task } from '@/types'
import { getLabelBgForColor } from '@/utils/labelColors'

export type CalendarColorBy = 'label' | 'status'

export const CALENDAR_COLOR_BY_KEY = 'bullet-journal-calendar-color-by'

export function parseCalendarColorBy(value: unknown): CalendarColorBy {
  return value === 'status' ? 'status' : 'label'
}

export function getCalendarTaskColors(
  task: Task,
  colorBy: CalendarColorBy,
  labels: Label[],
  getStatusItem: (id: string) => StatusItem,
): { color: string; bgColor: string } {
  if (colorBy === 'label') {
    const labelId = task.labels[0]
    const label = labelId
      ? labels.find((item) => item.id === labelId)
      : undefined
    if (label) {
      return { color: label.color, bgColor: getLabelBgForColor(label.color) }
    }
  }
  const status = getStatusItem(task.status)
  return { color: status.color, bgColor: status.bgColor }
}
