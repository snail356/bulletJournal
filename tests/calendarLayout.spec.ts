import { describe, expect, it } from 'vitest'
import type { Task } from '@/types'
import { layoutWeekSegments } from '@/utils/calendarLayout'

function task(id: string, date: string, endDate: string | null = null): Task {
  return { id, date, endDate } as Task
}

const week = [
  '2026-09-13',
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
  '2026-09-18',
  '2026-09-19',
]

describe('layoutWeekSegments', () => {
  it('拖拉預覽時維持被拖任務的 lane，不因重疊重排而上下跳動', () => {
    const tasks = [
      task('long', '2026-09-14', '2026-09-16'),
      task('short', '2026-09-15'),
    ]

    const origin = layoutWeekSegments(tasks, week)
    const shortLane = origin.segments.find((item) => item.taskId === 'short')?.lane
    expect(shortLane).toBe(1)

    const preview = {
      short: { date: '2026-09-13', endDate: null },
    }

    const unpacked = layoutWeekSegments(tasks, week, preview)
    expect(unpacked.segments.find((item) => item.taskId === 'short')?.lane).toBe(0)

    const pinned = layoutWeekSegments(tasks, week, preview, { short: 1 })
    expect(pinned.segments.find((item) => item.taskId === 'short')?.lane).toBe(1)
    expect(pinned.segments.find((item) => item.taskId === 'long')?.lane).toBe(0)
  })
})
