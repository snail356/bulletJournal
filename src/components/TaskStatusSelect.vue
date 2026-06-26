<script setup lang="ts">
import type { TaskStatus } from '@/types'
import { ALL_STATUSES, STATUS_BG, STATUS_COLORS, STATUS_LABELS } from '@/utils/status'

defineProps<{
  modelValue: TaskStatus
}>()

const emit = defineEmits<{
  'update:modelValue': [value: TaskStatus]
}>()
</script>

<template>
  <div class="status-select">
    <button
      v-for="status in ALL_STATUSES"
      :key="status"
      type="button"
      class="status-option"
      :class="{ active: modelValue === status }"
      :style="{
        '--c': STATUS_COLORS[status],
        '--bg': STATUS_BG[status],
      }"
      @click="emit('update:modelValue', status)"
    >
      <span class="dot" />
      {{ STATUS_LABELS[status] }}
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.status-select {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.status-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 20px;
  font-size: 12px;
  background: var(--bg);
  color: var(--c);
  border: 1px solid transparent;

  &.active {
    border-color: var(--c);
    font-weight: 600;
  }

  &:hover {
    filter: brightness(0.97);
  }
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c);
}
</style>
