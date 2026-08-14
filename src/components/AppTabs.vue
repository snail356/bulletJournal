<script setup lang="ts">
import { computed, useId } from 'vue'
import AppIcon from './AppIcon.vue'
import type { AppIconName } from '@/plugins/fontawesome'

export interface AppTabItem {
  id: string
  label: string
  icon?: AppIconName
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    tabs: AppTabItem[]
    ariaLabel?: string
  }>(),
  { ariaLabel: '分頁' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const instanceId = useId()
const tabRefs: HTMLButtonElement[] = []

const enabledTabs = computed(() =>
  props.tabs
    .map((tab, index) => ({ tab, index }))
    .filter(({ tab }) => !tab.disabled),
)

function panelId(id: string) {
  return `${instanceId}-panel-${id}`
}

function tabId(id: string) {
  return `${instanceId}-tab-${id}`
}

function setTabRef(index: number, el: unknown) {
  if (el instanceof HTMLButtonElement) {
    tabRefs[index] = el
  }
}

function select(id: string) {
  const tab = props.tabs.find((item) => item.id === id)
  if (!tab || tab.disabled || tab.id === props.modelValue) return
  emit('update:modelValue', id)
}

function focusTab(index: number) {
  const tab = props.tabs[index]
  if (!tab || tab.disabled) return
  select(tab.id)
  tabRefs[index]?.focus()
}

function onKeydown(event: KeyboardEvent, index: number) {
  if (!enabledTabs.value.length) return

  const currentPos = enabledTabs.value.findIndex((item) => item.index === index)
  if (currentPos < 0) return

  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault()
    const dir = event.key === 'ArrowRight' ? 1 : -1
    const nextPos = (currentPos + dir + enabledTabs.value.length) % enabledTabs.value.length
    focusTab(enabledTabs.value[nextPos].index)
  } else if (event.key === 'Home') {
    event.preventDefault()
    focusTab(enabledTabs.value[0].index)
  } else if (event.key === 'End') {
    event.preventDefault()
    focusTab(enabledTabs.value[enabledTabs.value.length - 1].index)
  }
}
</script>

<template>
  <div class="app-tabs">
    <div class="tab-list" role="tablist" :aria-label="ariaLabel">
      <button
        v-for="(tab, index) in tabs"
        :id="tabId(tab.id)"
        :key="tab.id"
        :ref="(el) => setTabRef(index, el)"
        type="button"
        class="tab"
        role="tab"
        :class="{ active: modelValue === tab.id }"
        :aria-selected="modelValue === tab.id"
        :aria-controls="panelId(tab.id)"
        :tabindex="modelValue === tab.id ? 0 : -1"
        :disabled="tab.disabled"
        @click="select(tab.id)"
        @keydown="onKeydown($event, index)"
      >
        <AppIcon v-if="tab.icon" :name="tab.icon" size="xs" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <div
      v-for="tab in tabs"
      :id="panelId(tab.id)"
      :key="tab.id"
      class="tab-panel"
      role="tabpanel"
      :hidden="modelValue !== tab.id"
      :aria-labelledby="tabId(tab.id)"
    >
      <slot :name="tab.id" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.app-tabs {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tab-list {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  border-bottom: 1px solid $border;
  margin-bottom: 20px;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 10px 14px;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  color: $text-muted;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s, background 0.15s;

  &:hover:not(:disabled):not(.active) {
    color: $text;
    background: $bg;
  }

  &.active {
    color: $primary;
    border-bottom-color: $primary;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid rgba($primary, 0.35);
    outline-offset: -2px;
    border-radius: $radius-sm $radius-sm 0 0;
  }
}

.tab-panel {
  min-width: 0;

  &[hidden] {
    display: none;
  }
}

@media (max-width: $breakpoint-xs) {
  .tab {
    padding: 10px 12px;
    font-size: 13px;
  }
}
</style>
