<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '@/types'
import AppIcon from '@/components/AppIcon.vue'
import { useTaskStore } from '@/stores/taskStore'
import { formatShortDateRange, getTaskDuration } from '@/utils/date'
import type { CalendarDragMode } from '@/composables/useCalendarDrag'

const props = defineProps<{
  task: Task
  color: string
  bgColor: string
  continuesBefore: boolean
  continuesAfter: boolean
  dragging: boolean
  dragMode: CalendarDragMode | null
}>()

const emit = defineEmits<{
  moveStart: [event: PointerEvent]
  resizeStart: [event: PointerEvent]
  resizeEnd: [event: PointerEvent]
  select: []
}>()

const store = useTaskStore()
const avatar = computed(() => store.getTaskAvatar(props.task.avatarId))
const duration = computed(() => getTaskDuration(props.task))
const dateRange = computed(() => formatShortDateRange(props.task))

const cursor = computed(() => {
  if (!props.dragging) return 'grab'
  if (props.dragMode === 'resize-start' || props.dragMode === 'resize-end') {
    return 'ew-resize'
  }
  return 'grabbing'
})
</script>

<template>
  <div
    class="task-block"
    :class="{
      dragging,
      completed: task.completed,
      'continues-before': continuesBefore,
      'continues-after': continuesAfter,
    }"
    :style="{
      '--task-color': color,
      '--task-bg': bgColor,
      cursor,
    }"
    :title="`${task.title}（${dateRange} · ${duration} 天）`"
    @pointerdown="emit('moveStart', $event)"
    @click.stop="emit('select')"
  >
    <button
      v-if="!continuesBefore"
      type="button"
      class="handle handle-start"
      aria-label="調整開始日期"
      @pointerdown.stop="emit('resizeStart', $event)"
      @click.stop
    />
    <span v-if="avatar" class="avatar" aria-hidden="true">
      <AppIcon :name="avatar.icon" size="xs" />
    </span>
    <span class="title">{{ task.title }}</span>
    <span v-if="duration > 1" class="duration">{{ duration }}天</span>
    <button
      v-if="!continuesAfter"
      type="button"
      class="handle handle-end"
      aria-label="調整結束日期"
      @pointerdown.stop="emit('resizeEnd', $event)"
      @click.stop
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.task-block {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 22px;
  padding: 0 10px;
  border-radius: 6px;
  background: var(--task-bg);
  color: var(--task-color);
  border: 1px solid color-mix(in srgb, var(--task-color) 35%, transparent);
  font-size: 12px;
  font-weight: 600;
  user-select: none;
  touch-action: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

  &:hover,
  &.dragging {
    z-index: 2;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--task-color) 25%, transparent);
  }

  &.completed {
    opacity: 0.62;

    .title {
      text-decoration: line-through;
    }
  }

  &.continues-before {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    padding-left: 8px;
  }

  &.continues-after {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    padding-right: 8px;
  }
}

.title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
}

.duration {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  opacity: 0.75;
}

.handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 10px;
  padding: 0;
  cursor: ew-resize;
  z-index: 1;

  &::after {
    content: '';
    position: absolute;
    top: 5px;
    bottom: 5px;
    width: 2px;
    border-radius: 1px;
    background: currentColor;
    opacity: 0;
    transition: opacity 0.12s;
  }

  &:hover::after,
  .task-block.dragging &::after {
    opacity: 0.45;
  }
}

.handle-start {
  left: 0;

  &::after {
    left: 3px;
  }
}

.handle-end {
  right: 0;

  &::after {
    right: 3px;
  }
}
</style>
