import { computed, onUnmounted, ref } from 'vue'
import { addDays, daysBetween, normalizeEndDate } from '@/utils/date'

export type CalendarDragMode = 'move' | 'resize-start' | 'resize-end'

export interface CalendarDragPreview {
  date: string
  endDate: string | null
}

interface DragSession {
  taskId: string
  mode: CalendarDragMode
  originStart: string
  originEndStored: string | null
  originEffectiveEnd: string
  anchorDate: string
  pointerId: number
  startX: number
  startY: number
  moved: boolean
}

const DRAG_THRESHOLD_PX = 4

function computePreview(
  session: DragSession,
  currentDate: string,
): CalendarDragPreview {
  if (session.mode === 'move') {
    const delta = daysBetween(session.anchorDate, currentDate)
    const nextStart = addDays(session.originStart, delta)
    const nextEnd = session.originEndStored
      ? addDays(session.originEndStored, delta)
      : null
    return { date: nextStart, endDate: nextEnd }
  }

  if (session.mode === 'resize-start') {
    if (currentDate >= session.originEffectiveEnd) {
      return { date: session.originEffectiveEnd, endDate: null }
    }
    return {
      date: currentDate,
      endDate: normalizeEndDate(currentDate, session.originEffectiveEnd),
    }
  }

  if (currentDate <= session.originStart) {
    return { date: session.originStart, endDate: null }
  }
  return {
    date: session.originStart,
    endDate: normalizeEndDate(session.originStart, currentDate),
  }
}

export function useCalendarDrag(options: {
  hitTestDate: (x: number, y: number) => string | null
  onCommit: (taskId: string, preview: CalendarDragPreview) => void
}) {
  const session = ref<DragSession | null>(null)
  const preview = ref<CalendarDragPreview | null>(null)
  const ignoreNextClick = ref(false)

  const draggingTaskId = computed(() => session.value?.taskId ?? null)
  const dragMode = computed(() => session.value?.mode ?? null)

  const previewByTask = computed<Record<string, CalendarDragPreview>>(() => {
    if (!session.value || !preview.value) return {}
    return { [session.value.taskId]: preview.value }
  })

  function beginDrag(
    event: PointerEvent,
    payload: {
      taskId: string
      mode: CalendarDragMode
      originStart: string
      originEndStored: string | null
      originEffectiveEnd: string
      anchorDate: string
    },
  ) {
    if (event.button !== 0) return
    event.stopPropagation()
    ;(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(
      event.pointerId,
    )
    session.value = {
      ...payload,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }
    preview.value = {
      date: payload.originStart,
      endDate: payload.originEndStored,
    }
    document.body.style.userSelect = 'none'
  }

  function onPointerMove(event: PointerEvent) {
    const current = session.value
    if (!current || event.pointerId !== current.pointerId) return

    if (!current.moved) {
      const dx = event.clientX - current.startX
      const dy = event.clientY - current.startY
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
      current.moved = true
      event.preventDefault()
    }

    const date = options.hitTestDate(event.clientX, event.clientY)
    if (!date) return
    preview.value = computePreview(current, date)
  }

  function finish(commit: boolean) {
    const current = session.value
    const next = preview.value
    if (current?.moved) ignoreNextClick.value = true
    session.value = null
    preview.value = null
    document.body.style.userSelect = ''
    if (
      commit &&
      current?.moved &&
      next &&
      (next.date !== current.originStart ||
        next.endDate !== current.originEndStored)
    ) {
      options.onCommit(current.taskId, next)
    }
  }

  function consumeClickSuppression(): boolean {
    if (!ignoreNextClick.value) return false
    ignoreNextClick.value = false
    return true
  }

  function onPointerUp(event: PointerEvent) {
    const current = session.value
    if (!current || event.pointerId !== current.pointerId) return
    finish(true)
  }

  function onPointerCancel(event: PointerEvent) {
    const current = session.value
    if (!current || event.pointerId !== current.pointerId) return
    finish(false)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && session.value) finish(false)
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  window.addEventListener('keydown', onKeyDown)

  onUnmounted(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerCancel)
    window.removeEventListener('keydown', onKeyDown)
    document.body.style.userSelect = ''
  })

  return {
    beginDrag,
    draggingTaskId,
    dragMode,
    preview,
    previewByTask,
    consumeClickSuppression,
  }
}
