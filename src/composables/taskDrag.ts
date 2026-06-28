import type { InjectionKey } from 'vue'
import type { ReorderDragHandlers } from './useReorderDrag'

export const TASK_DRAG_KEY: InjectionKey<ReorderDragHandlers> = Symbol('taskDrag')
export const SUBTASK_DRAG_KEY: InjectionKey<ReorderDragHandlers> = Symbol('subtaskDrag')
