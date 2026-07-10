<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import { getLabelBgForColor } from '@/utils/labelColors'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const store = useTaskStore()
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const selectedItems = computed(() =>
  props.modelValue
    .map((id) => store.labels.find((label) => label.id === id))
    .filter((label): label is NonNullable<typeof label> => Boolean(label)),
)

const triggerStyle = computed(() => {
  if (!selectedItems.value.length) {
    return { color: '#9ca3af', background: '#f3f4f6' }
  }
  const first = selectedItems.value[0]
  return {
    color: first.color,
    background: getLabelBgForColor(first.color),
  }
})

const triggerText = computed(() => {
  if (!selectedItems.value.length) return '標籤'
  return selectedItems.value.map((label) => label.name).join('、')
})

function isSelected(id: string) {
  return props.modelValue.includes(id)
}

function toggle() {
  open.value = !open.value
}

function toggleLabel(id: string) {
  const next = [...props.modelValue]
  const idx = next.indexOf(id)
  if (idx >= 0) next.splice(idx, 1)
  else next.push(id)
  emit('update:modelValue', next)
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
  <div v-if="store.labels.length" ref="rootRef" class="status-dropdown">
    <button
      type="button"
      class="trigger"
      :style="triggerStyle"
      @click.stop="toggle"
    >
      {{ triggerText }}
      <AppIcon name="chevron-down" size="xs" class="chevron" :class="{ open }" />
    </button>

    <div v-if="open" class="menu">
      <button
        v-for="label in store.labels"
        :key="label.id"
        type="button"
        class="option"
        :class="{ active: isSelected(label.id) }"
        :style="{
          '--c': label.color,
          '--bg': getLabelBgForColor(label.color),
        }"
        @click.stop="toggleLabel(label.id)"
      >
        <span class="dot" />
        {{ label.name }}
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
  max-width: 100%;

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
  max-height: 240px;
  overflow-y: auto;
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
