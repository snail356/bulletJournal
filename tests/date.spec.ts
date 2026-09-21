import { describe, expect, it } from 'vitest'
import { bringTaskRangeToDate, taskOverlapsDate } from '@/utils/date'

describe('bringTaskRangeToDate', () => {
  it('已涵蓋目標日時不改動', () => {
    const task = { date: '2026-09-10', endDate: '2026-09-21' }
    expect(bringTaskRangeToDate(task, '2026-09-14')).toBe('already')
    expect(task).toEqual({ date: '2026-09-10', endDate: '2026-09-21' })
  })

  it('單日任務已在目標日時不改動', () => {
    const task = { date: '2026-09-21', endDate: null }
    expect(bringTaskRangeToDate(task, '2026-09-21')).toBe('already')
    expect(task.endDate).toBeNull()
  })

  it('目標日晚於結束日時延後 endDate，保留開始日', () => {
    const task = { date: '2026-09-10', endDate: '2026-09-12' }
    expect(bringTaskRangeToDate(task, '2026-09-21')).toBe('extended')
    expect(task.date).toBe('2026-09-10')
    expect(task.endDate).toBe('2026-09-21')
    expect(taskOverlapsDate(task, '2026-09-21')).toBe(true)
  })

  it('單日任務可延後為跨日', () => {
    const task = { date: '2026-09-10', endDate: null }
    expect(bringTaskRangeToDate(task, '2026-09-21')).toBe('extended')
    expect(task).toEqual({ date: '2026-09-10', endDate: '2026-09-21' })
  })

  it('目標日早於開始日時往前擴張，保留原結束日', () => {
    const task = { date: '2026-09-25', endDate: '2026-09-28' }
    expect(bringTaskRangeToDate(task, '2026-09-21')).toBe('extended')
    expect(task.date).toBe('2026-09-21')
    expect(task.endDate).toBe('2026-09-28')
  })

  it('目標日早於單日任務時改為跨日區間', () => {
    const task = { date: '2026-09-25', endDate: null }
    expect(bringTaskRangeToDate(task, '2026-09-21')).toBe('extended')
    expect(task).toEqual({ date: '2026-09-21', endDate: '2026-09-25' })
  })
})
