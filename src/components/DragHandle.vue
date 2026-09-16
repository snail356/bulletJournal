<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import type { AppIconName } from '@/plugins/fontawesome'

withDefaults(
  defineProps<{
    label?: string
    size?: 'xs' | 'sm' | 'lg'
    icon?: AppIconName
  }>(),
  {
    label: '拖曳排序',
    size: 'sm',
    icon: 'grip-vertical',
  },
)

const emit = defineEmits<{
  dragStart: [event: DragEvent]
  dragEnd: []
}>()
</script>

<template>
  <span
    class="drag-handle"
    draggable="true"
    :aria-label="label"
    @click.stop
    @dragstart="emit('dragStart', $event)"
    @dragend="emit('dragEnd')"
  >
    <AppIcon :name="icon" :size="size" />
  </span>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.drag-handle {
  color: $text-muted;
  cursor: grab;
  opacity: 0.4;
  line-height: 1;
  flex-shrink: 0;
  user-select: none;
  display: inline-flex;
  align-items: center;

  &:hover {
    opacity: 0.8;
  }

  &:active {
    cursor: grabbing;
  }
}
</style>
