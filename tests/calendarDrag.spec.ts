import { defineComponent } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CalendarTaskBlock from '@/components/CalendarTaskBlock.vue'
import {
  useCalendarDrag,
  type CalendarDragMode,
} from '@/composables/useCalendarDrag'
import type { Task } from '@/types'

function task(): Task {
  return {
    id: 'task-1',
    date: '2026-10-12',
    endDate: null,
    title: '寫週報',
    avatarId: null,
    status: 'todo',
    statusHours: null,
    bodyContent: '',
    bodyContentType: 'text',
    completed: false,
    subtasks: [],
    notes: [],
    attachments: [],
    labels: [],
    migrationHistory: [],
    backlogIssueId: null,
    backlogIssueKey: null,
    backlogUrl: null,
    createdAt: '2026-10-12T00:00:00.000Z',
    updatedAt: '2026-10-12T00:00:00.000Z',
  }
}

function mountBlock(options?: {
  onActivate?: (taskId: string) => void
  onCommit?: (taskId: string, preview: { date: string; endDate: string | null }) => void
  hitTestDate?: (x: number, y: number) => string | null
}) {
  const item = task()
  const onActivate = options?.onActivate ?? vi.fn()
  const onCommit = options?.onCommit ?? vi.fn()
  const Comp = defineComponent({
    components: { CalendarTaskBlock },
    setup() {
      const drag = useCalendarDrag({
        hitTestDate: options?.hitTestDate ?? (() => item.date),
        onCommit,
        onActivate,
      })
      function start(event: PointerEvent, mode: CalendarDragMode) {
        drag.beginDrag(event, {
          taskId: item.id,
          mode,
          originStart: item.date,
          originEndStored: item.endDate,
          originEffectiveEnd: item.date,
          originLane: 0,
          anchorDate: item.date,
        })
      }
      return { item, start }
    },
    template: `
      <CalendarTaskBlock
        :task="item"
        color="#336"
        bg-color="#eef"
        :continues-before="false"
        :continues-after="false"
        :dragging="false"
        :drag-mode="null"
        @move-start="start($event, 'move')"
        @resize-start="start($event, 'resize-start')"
        @resize-end="start($event, 'resize-end')"
      />
    `,
  })
  const wrapper = mount(Comp, { global: { plugins: [createPinia()] } })
  return { wrapper, item, onActivate, onCommit }
}

function pointer(
  type: string,
  init: PointerEventInit,
  target: EventTarget = window,
) {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, ...init }),
  )
}

describe('calendar task click', () => {
  let wrapper: VueWrapper | null = null
  const setPointerCapture = vi.fn()
  const originalSetPointerCapture = HTMLElement.prototype.setPointerCapture

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    setPointerCapture.mockReset()
    HTMLElement.prototype.setPointerCapture = originalSetPointerCapture
    document.body.style.userSelect = ''
  })

  it('opens the task when the title is clicked without dragging', () => {
    HTMLElement.prototype.setPointerCapture = setPointerCapture
    const mounted = mountBlock()
    wrapper = mounted.wrapper

    pointer(
      'pointerdown',
      { button: 0, pointerId: 1, clientX: 12, clientY: 8 },
      mounted.wrapper.get('.title').element,
    )
    pointer('pointerup', { button: 0, pointerId: 1, clientX: 12, clientY: 8 })

    expect(mounted.onActivate).toHaveBeenCalledWith('task-1')
    expect(mounted.onCommit).not.toHaveBeenCalled()
    expect(setPointerCapture).not.toHaveBeenCalled()
  })

  it('moves the task instead of opening it after the pointer passes the drag threshold', () => {
    HTMLElement.prototype.setPointerCapture = setPointerCapture
    const mounted = mountBlock({
      hitTestDate: () => '2026-10-13',
    })
    wrapper = mounted.wrapper

    pointer(
      'pointerdown',
      { button: 0, pointerId: 1, clientX: 10, clientY: 8 },
      mounted.wrapper.get('.title').element,
    )
    pointer('pointermove', { pointerId: 1, clientX: 40, clientY: 8 })
    pointer('pointerup', { pointerId: 1, clientX: 40, clientY: 8 })

    expect(mounted.onActivate).not.toHaveBeenCalled()
    expect(mounted.onCommit).toHaveBeenCalledWith('task-1', {
      date: '2026-10-13',
      endDate: null,
    })
    expect(setPointerCapture).toHaveBeenCalledTimes(1)
  })

  it('does not open the task when a resize handle is clicked', () => {
    const mounted = mountBlock()
    wrapper = mounted.wrapper

    pointer(
      'pointerdown',
      { button: 0, pointerId: 1, clientX: 2, clientY: 8 },
      mounted.wrapper.get('.handle-start').element,
    )
    pointer('pointerup', { button: 0, pointerId: 1, clientX: 2, clientY: 8 })

    expect(mounted.onActivate).not.toHaveBeenCalled()
    expect(mounted.onCommit).not.toHaveBeenCalled()
  })
})
