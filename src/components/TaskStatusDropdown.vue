<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { TaskStatus } from '@/types'
import { useTaskStore } from '@/stores/taskStore'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  modelValue: TaskStatus
}>()

const emit = defineEmits<{
  'update:modelValue': [value: TaskStatus]
}>()

const store = useTaskStore()
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const current = computed(() => store.getStatusItem(props.modelValue))

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
        color: current.color,
        background: current.bgColor,
      }"
      @click.stop="toggle"
    >
      {{ current.name }}
      <AppIcon name="chevron-down" size="xs" class="chevron" :class="{ open }" />
    </button>

    <div v-if="open" class="menu">
      <button
        v-for="item in store.statusItems"
        :key="item.id"
        type="button"
        class="option"
        :class="{ active: modelValue === item.id }"
        :style="{
          '--c': item.color,
          '--bg': item.bgColor,
        }"
        @click="select(item.id)"
      >
        <span class="dot" />
        {{ item.name }}
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
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  text-align: left;
  line-height: 1.35;
  max-width: 100%;

  &:hover {
    border-color: currentColor;
  }
}

.chevron {
  flex-shrink: 0;
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
  min-width: max(160px, 100%);
  max-width: min(280px, calc(100vw - 32px));
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
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--c);
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.4;

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

@media (max-width: $breakpoint-sm) {
  .status-dropdown {
    max-width: 100%;
  }

  .trigger {
    max-width: 100%;
  }

  .menu {
    left: auto;
    right: 0;
    min-width: min(160px, calc(100vw - 32px));
  }
}
</style>
