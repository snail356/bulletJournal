<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { TaskStatus } from '@/types'
import { ALL_STATUSES, STATUS_BG, STATUS_COLORS, STATUS_LABELS } from '@/utils/status'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  modelValue: TaskStatus
}>()

const emit = defineEmits<{
  'update:modelValue': [value: TaskStatus]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

function toggle() {
  open.value = !open.value
}

function select(status: TaskStatus) {
  emit('update:modelValue', status)
  open.value = false
}

function onClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="rootRef" class="status-dropdown">
    <button
      type="button"
      class="trigger"
      :style="{
        color: STATUS_COLORS[modelValue],
        background: STATUS_BG[modelValue],
      }"
      @click.stop="toggle"
    >
      {{ STATUS_LABELS[modelValue] }}
      <AppIcon name="chevron-down" size="xs" class="chevron" :class="{ open }" />
    </button>

    <div v-if="open" class="menu">
      <button
        v-for="status in ALL_STATUSES"
        :key="status"
        type="button"
        class="option"
        :class="{ active: modelValue === status }"
        :style="{
          '--c': STATUS_COLORS[status],
          '--bg': STATUS_BG[status],
        }"
        @click="select(status)"
      >
        <span class="dot" />
        {{ STATUS_LABELS[status] }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.status-dropdown {
  position: relative;
  display: inline-block;
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s;

  &:hover {
    border-color: currentColor;
  }
}

.chevron {
  transition: transform 0.15s;

  &.open {
    transform: rotate(180deg);
  }
}

.menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 100;
  min-width: 160px;
  background: $surface;
  border: 1px solid $border;
  border-radius: $radius-sm;
  box-shadow: $shadow-lg;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--c);
  text-align: left;

  &:hover {
    background: var(--bg);
  }

  &.active {
    background: var(--bg);
    font-weight: 600;
  }
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c);
  flex-shrink: 0;
}
</style>
