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

function segmentGeometry(
  task: Task,
  weekDates: string[],
): Omit<CalendarLaneSegment, 'taskId' | 'lane'> | null {
  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]
  const start = task.date
  const end = getTaskEndDate(task)
  const visStart = start < weekStart ? weekStart : start
  const visEnd = end > weekEnd ? weekEnd : end
  const startCol = weekDates.indexOf(visStart)
  const endCol = weekDates.indexOf(visEnd)
  if (startCol < 0 || endCol < 0) return null
  return {
    startCol,
    span: endCol - startCol + 1,
    continuesBefore: start < weekStart,
    continuesAfter: end > weekEnd,
  }
}

function packWeekSegments(
  tasks: Task[],
  weekDates: string[],
  preview: Record<string, { date: string; endDate: string | null }>,
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
    const geometry = segmentGeometry(task, weekDates)
    if (!geometry) continue
    const visStart = weekDates[geometry.startCol]
    const visEnd = weekDates[geometry.startCol + geometry.span - 1]

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
      ...geometry,
    })
  }

  return {
    dates: weekDates,
    segments,
    laneCount: Math.max(laneEnds.length, 1),
  }
}

export function layoutWeekSegments(
  tasks: Task[],
  weekDates: string[],
  preview: Record<string, { date: string; endDate: string | null }> = {},
  pinnedLanes: Record<string, number> = {},
): WeekLayout {
  const pinnedIds = Object.keys(pinnedLanes)
  const hasPinnedPreview =
    pinnedIds.length > 0 && pinnedIds.some((taskId) => preview[taskId])

  if (!hasPinnedPreview) {
    return packWeekSegments(tasks, weekDates, preview)
  }

  const base = packWeekSegments(tasks, weekDates, {})
  const pinnedIdSet = new Set(pinnedIds)
  const segments = base.segments.filter(
    (segment) => !pinnedIdSet.has(segment.taskId),
  )
  let laneCount = base.laneCount

  for (const task of tasks) {
    const lane = pinnedLanes[task.id]
    if (lane == null || !preview[task.id]) continue
    const geometry = segmentGeometry(applyPreview(task, preview), weekDates)
    if (!geometry) continue
    laneCount = Math.max(laneCount, lane + 1)
    segments.push({
      taskId: task.id,
      lane,
      ...geometry,
    })
  }

  return {
    dates: weekDates,
    segments,
    laneCount,
  }
}

/** 將週排程裁切到當月格子，並壓實因跨月被裁掉而空出的 lane */
export function clipLayoutToMonth(
  layout: WeekLayout,
  days: Date[],
  month: number,
): WeekLayout {
  const inMonth = days.map((day) => day.getMonth() === month)
  const clipped: CalendarLaneSegment[] = []

  for (const segment of layout.segments) {
    let start = segment.startCol
    let end = segment.startCol + segment.span - 1
    while (start <= end && !inMonth[start]) start += 1
    while (end >= start && !inMonth[end]) end -= 1
    if (start > end) continue
    clipped.push({
      ...segment,
      startCol: start,
      span: end - start + 1,
      continuesBefore: segment.continuesBefore || start > segment.startCol,
      continuesAfter:
        segment.continuesAfter || end < segment.startCol + segment.span - 1,
    })
  }

  const usedLanes = [...new Set(clipped.map((item) => item.lane))].sort(
    (a, b) => a - b,
  )
  const laneMap = new Map(usedLanes.map((lane, index) => [lane, index]))
  const segments = clipped.map((item) => ({
    ...item,
    lane: laneMap.get(item.lane)!,
  }))

  return {
    dates: layout.dates,
    segments,
    laneCount: usedLanes.length,
  }
}

export function weekDateStrings(days: Date[]): string[] {
  return days.map(formatDate)
}
