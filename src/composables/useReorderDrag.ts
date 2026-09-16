import { ref, type Ref } from 'vue'

interface Reorderable {
  id: string
  completed: boolean
}

export interface ReorderDragHandlers {
  draggingId: Ref<string | null>
  dragOverId: Ref<string | null>
  onDragStart: (e: DragEvent, id: string) => void
  onDragOver: (e: DragEvent, targetId: string) => void
  onDrop: (e: DragEvent, targetId: string) => void
  onDragEnd: () => void
}

export function moveItemById<T extends { id: string }>(
  items: T[],
  fromId: string,
  toId: string,
): T[] | null {
  if (fromId === toId) return null
  const fromIdx = items.findIndex((item) => item.id === fromId)
  const toIdx = items.findIndex((item) => item.id === toId)
  if (fromIdx < 0 || toIdx < 0) return null
  const next = [...items]
  const [moved] = next.splice(fromIdx, 1)
  next.splice(toIdx, 0, moved)
  return next
}

function belongsToList(items: { id: string }[], id: string | null): boolean {
  return Boolean(id && items.some((item) => item.id === id))
}

function shouldReorderAt(
  items: { id: string }[],
  fromId: string,
  targetId: string,
  insertAfter: boolean,
): boolean {
  const fromIdx = items.findIndex((i) => i.id === fromId)
  const toIdx = items.findIndex((i) => i.id === targetId)
  if (fromIdx < 0 || toIdx < 0) return false
  if (insertAfter) return fromIdx !== toIdx + 1
  return fromIdx !== toIdx - 1
}

export function useReorderDrag<T extends Reorderable>(
  getItems: () => T[],
  onReorder: (fromId: string, toId: string) => void,
): ReorderDragHandlers {
  const draggingId = ref<string | null>(null)
  const dragOverId = ref<string | null>(null)

  function getItem(items: T[], id: string) {
    return items.find((i) => i.id === id)
  }

  function canDrop(items: T[], fromId: string, toId: string) {
    if (fromId === toId) return false
    const from = getItem(items, fromId)
    const to = getItem(items, toId)
    return from && to && from.completed === to.completed
  }

  function onDragStart(e: DragEvent, id: string) {
    draggingId.value = id
    dragOverId.value = null
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
    }
  }

  function onDragOver(e: DragEvent, targetId: string) {
    e.preventDefault()
    e.stopPropagation()
    const items = getItems()
    const fromId = draggingId.value
    if (!fromId || fromId === targetId) return
    if (!canDrop(items, fromId, targetId)) return

    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'

    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const insertAfter = e.clientY >= rect.top + rect.height / 2

    dragOverId.value = targetId

    if (shouldReorderAt(items, fromId, targetId, insertAfter)) {
      onReorder(fromId, targetId)
    }
  }

  function onDrop(e: DragEvent, _targetId: string) {
    e.preventDefault()
    e.stopPropagation()
    draggingId.value = null
    dragOverId.value = null
  }

  function onDragEnd() {
    draggingId.value = null
    dragOverId.value = null
  }

  return {
    draggingId,
    dragOverId,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  }
}

/** Unconstrained reorder for items without completed grouping (e.g. labels). */
export function useSimpleReorderDrag(
  getItems: () => { id: string }[],
  onReorder: (fromId: string, toId: string) => void,
) {
  const draggingId = ref<string | null>(null)
  const dragOverId = ref<string | null>(null)

  function onDragStart(e: DragEvent, id: string) {
    draggingId.value = id
    dragOverId.value = null
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
    }
  }

  function onDragOver(e: DragEvent, targetId: string) {
    e.preventDefault()
    const fromId = draggingId.value
    if (!fromId || fromId === targetId) return
    const items = getItems()
    if (!belongsToList(items, fromId) || !belongsToList(items, targetId)) return
    e.stopPropagation()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'

    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const insertAfter = e.clientY >= rect.top + rect.height / 2

    dragOverId.value = targetId

    if (shouldReorderAt(items, fromId, targetId, insertAfter)) {
      onReorder(fromId, targetId)
    }
  }

  function onDrop(e: DragEvent, _targetId: string) {
    const items = getItems()
    if (!belongsToList(items, draggingId.value)) return
    e.preventDefault()
    e.stopPropagation()
    draggingId.value = null
    dragOverId.value = null
  }

  function onDragEnd() {
    draggingId.value = null
    dragOverId.value = null
  }

  return {
    draggingId,
    dragOverId,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  }
}
