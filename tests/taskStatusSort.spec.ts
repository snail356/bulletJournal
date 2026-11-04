import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useTaskStore } from '@/stores/taskStore'
import { COMPLETED_STATUS_ID, DEFAULT_STATUS_ID } from '@/utils/status'

const VIEW_DATE = '2026-11-04'

function activeIds(date = VIEW_DATE): string[] {
  const store = useTaskStore()
  return store
    .getTasksByDate(date)
    .filter((view) => !view.migratedAway)
    .map((view) => view.task.id)
}

describe('套用狀態時調整主任務位置', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('進行中設為置頂時，跨日任務會移到目前檢視日清單最上方', () => {
    const store = useTaskStore()
    store.selectedDate = VIEW_DATE
    store.updateStatusItem(DEFAULT_STATUS_ID, { sortOnSelect: 'top' })

    const older = store.createTask({
      date: '2026-11-01',
      title: '跨日起始',
      endDate: VIEW_DATE,
      status: 'paused',
    })
    const todayFirst = store.createTask({
      date: VIEW_DATE,
      title: '今日較早',
      status: 'paused',
    })
    const todaySecond = store.createTask({
      date: VIEW_DATE,
      title: '今日較晚',
      status: 'paused',
    })

    expect(activeIds()).toEqual([todaySecond.id, todayFirst.id, older.id])

    store.applyTaskStatus(older.id, DEFAULT_STATUS_ID)

    expect(activeIds()).toEqual([older.id, todaySecond.id, todayFirst.id])
    expect(store.tasks.find((task) => task.id === older.id)?.status).toBe(
      DEFAULT_STATUS_ID,
    )
  })

  it('同一天任務切換置頂狀態也會移到清單最上方', () => {
    const store = useTaskStore()
    store.selectedDate = VIEW_DATE
    store.updateStatusItem(DEFAULT_STATUS_ID, { sortOnSelect: 'top' })

    const first = store.createTask({
      date: VIEW_DATE,
      title: '第一筆',
      status: 'paused',
    })
    const second = store.createTask({
      date: VIEW_DATE,
      title: '第二筆',
      status: 'paused',
    })
    const third = store.createTask({
      date: VIEW_DATE,
      title: '第三筆',
      status: 'paused',
    })

    store.applyTaskStatus(first.id, DEFAULT_STATUS_ID)

    expect(activeIds()).toEqual([first.id, third.id, second.id])
  })

  it('設為移至底部時，會排到未完成區最下方、已完成之上', () => {
    const store = useTaskStore()
    store.selectedDate = VIEW_DATE
    store.updateStatusItem('waiting_pm', { sortOnSelect: 'bottom' })

    const pending = store.createTask({
      date: VIEW_DATE,
      title: '進行中',
      status: DEFAULT_STATUS_ID,
    })
    const overlapping = store.createTask({
      date: '2026-11-02',
      title: '跨日待回覆',
      endDate: VIEW_DATE,
      status: DEFAULT_STATUS_ID,
    })
    const done = store.createTask({
      date: VIEW_DATE,
      title: '已完成',
      status: COMPLETED_STATUS_ID,
    })
    done.completed = true

    expect(activeIds()).toEqual([overlapping.id, pending.id, done.id])

    store.applyTaskStatus(overlapping.id, 'waiting_pm')

    expect(activeIds()).toEqual([pending.id, overlapping.id, done.id])
  })

  it('標記已完成會移到目前檢視日清單底部', () => {
    const store = useTaskStore()
    store.selectedDate = VIEW_DATE

    store.createTask({ date: VIEW_DATE, title: '仍進行中' })
    const overlapping = store.createTask({
      date: '2026-11-01',
      title: '跨日完成',
      endDate: VIEW_DATE,
    })

    expect(activeIds()[0]).toBe(overlapping.id)

    store.applyTaskStatus(overlapping.id, COMPLETED_STATUS_ID)

    const views = store
      .getTasksByDate(VIEW_DATE)
      .filter((view) => !view.migratedAway)
    expect(views.at(-1)?.task.id).toBe(overlapping.id)
    expect(views.at(-1)?.task.completed).toBe(true)
  })
})
