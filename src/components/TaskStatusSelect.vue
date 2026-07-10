<script setup lang="ts">
import type { TaskStatus } from '@/types'
import { useTaskStore } from '@/stores/taskStore'

defineProps<{
  modelValue: TaskStatus
}>()

const emit = defineEmits<{
  'update:modelValue': [value: TaskStatus]
}>()

const store = useTaskStore()
</script>

<template>
  <div class="status-select">
    <button
      v-for="item in store.statusItems"
      :key="item.id"
      type="button"
      class="status-option"
      :class="{ active: modelValue === item.id }"
      :style="{
        '--c': item.color,
        '--bg': item.bgColor,
      }"
      @click="emit('update:modelValue', item.id)"
    >
      <span class="dot" />
      {{ item.name }}
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
