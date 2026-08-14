import type { Task } from '@/types'
import {
  formatDate,
  getTaskEndDate,
  getTaskDuration,
  taskOverlapsRange,
} from '@/utils/date'

export interface CalendarLaneSegment {
  taskId: string
  lane: number
  startCol: number
  span: number
  continuesBefore: boolean
  continuesAfter: boolean
}

export interface WeekLayout {
  dates: string[]
  segments: CalendarLaneSegment[]
  laneCount: number
}

function applyPreview(
  task: Task,
  preview: Record<string, { date: string; endDate: string | null }>,
): Task {
  const next = preview[task.id]
  if (!next) return task
  return { ...task, date: next.date, endDate: next.endDate }
}

export function layoutWeekSegments(
  tasks: Task[],
  weekDates: string[],
  preview: Record<string, { date: string; endDate: string | null }> = {},
): WeekLayout {
  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]
  const overlapping = tasks
    .map((task) => applyPreview(task, preview))
    .filter((task) => taskOverlapsRange(task, weekStart, weekEnd))
    .sort((a, b) => {
      const startCmp = a.date.localeCompare(b.date)
      if (startCmp !== 0) return startCmp
      return getTaskDuration(b) - getTaskDuration(a)
    })

  const laneEnds: string[] = []
  const segments: CalendarLaneSegment[] = []

  for (const task of overlapping) {
    const start = task.date
    const end = getTaskEndDate(task)
    const visStart = start < weekStart ? weekStart : start
    const visEnd = end > weekEnd ? weekEnd : end
    const startCol = weekDates.indexOf(visStart)
    const endCol = weekDates.indexOf(visEnd)
    if (startCol < 0 || endCol < 0) continue

    let lane = laneEnds.findIndex((occupiedEnd) => occupiedEnd < visStart)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(visEnd)
    } else {
      laneEnds[lane] = visEnd
    }

    segments.push({
      taskId: task.id,
      lane,
      startCol,
      span: endCol - startCol + 1,
      continuesBefore: start < weekStart,
      continuesAfter: end > weekEnd,
    })
  }

  return {
    dates: weekDates,
    segments,
    laneCount: Math.max(laneEnds.length, 1),
  }
}

export function weekDateStrings(days: Date[]): string[] {
  return days.map(formatDate)
}
