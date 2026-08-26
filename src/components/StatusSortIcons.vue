<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { StatusSortOnSelect } from '@/types'
import type { AppIconName } from '@/plugins/fontawesome'
import AppIcon from '@/components/AppIcon.vue'
import { STATUS_SORT_OPTIONS } from '@/utils/status'

const props = defineProps<{
  modelValue: StatusSortOnSelect
}>()

const emit = defineEmits<{
  'update:modelValue': [value: StatusSortOnSelect]
}>()

const SORT_ICONS: Record<StatusSortOnSelect, AppIconName> = {
  none: 'minus',
  top: 'arrow-up',
  bottom: 'arrow-down',
}

const rootRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const open = ref(false)
const showTip = ref(false)
const menuStyle = ref<Record<string, string>>({})
const tooltipStyle = ref<Record<string, string>>({})

const current = computed(
  () =>
    STATUS_SORT_OPTIONS.find((opt) => opt.value === props.modelValue) ??
    STATUS_SORT_OPTIONS[0],
)

async function toggle() {
  showTip.value = false
  open.value = !open.value
  if (open.value) {
    await nextTick()
    updateMenuPosition()
  }
}

function select(value: StatusSortOnSelect) {
  emit('update:modelValue', value)
  open.value = false
}

function updateMenuPosition() {
  const trigger = rootRef.value?.getBoundingClientRect()
  const menu = menuRef.value?.getBoundingClientRect()
  if (!trigger || !menu) return

  let left = trigger.right - menu.width
  left = Math.max(8, Math.min(left, window.innerWidth - menu.width - 8))

  let top = trigger.bottom + 6
  if (top + menu.height > window.innerHeight - 8) {
    top = trigger.top - menu.height - 6
  }

  menuStyle.value = { left: `${left}px`, top: `${top}px` }
}

async function onTriggerEnter() {
  if (open.value) return
  showTip.value = true
  await nextTick()
  const trigger = rootRef.value?.getBoundingClientRect()
  const tip = tooltipRef.value?.getBoundingClientRect()
  if (!trigger || !tip) return

  let left = trigger.left + trigger.width / 2 - tip.width / 2
  left = Math.max(8, Math.min(left, window.innerWidth - tip.width - 8))
  let top = trigger.top - tip.height - 8
  if (top < 8) top = trigger.bottom + 8
  tooltipStyle.value = { left: `${left}px`, top: `${top}px` }
}

function onTriggerLeave() {
  showTip.value = false
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (rootRef.value?.contains(target) || menuRef.value?.contains(target)) return
  open.value = false
}

function closeOnScroll() {
  open.value = false
  showTip.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  window.addEventListener('scroll', closeOnScroll, true)
  window.addEventListener('resize', closeOnScroll)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
  window.removeEventListener('scroll', closeOnScroll, true)
  window.removeEventListener('resize', closeOnScroll)
})
</script>

<template>
  <div ref="rootRef" class="sort-picker">
    <button
      type="button"
      class="trigger"
      :class="{ active: modelValue !== 'none', open }"
      :aria-label="current.label"
      :aria-expanded="open"
      @click.stop="toggle"
      @mouseenter="onTriggerEnter"
      @mouseleave="onTriggerLeave"
    >
      <AppIcon :name="SORT_ICONS[current.value]" size="xs" />
    </button>

    <Teleport to="body">
      <div
        v-if="showTip && !open"
        ref="tooltipRef"
        class="sort-tooltip"
        role="tooltip"
        :style="tooltipStyle"
      >
        {{ current.label }}
      </div>
      <div
        v-if="open"
        ref="menuRef"
        class="sort-menu"
        role="menu"
        aria-label="套用時排序"
        :style="menuStyle"
      >
        <button
          v-for="opt in STATUS_SORT_OPTIONS"
          :key="opt.value"
          type="button"
          class="sort-option"
          :class="{ active: modelValue === opt.value }"
          role="menuitemradio"
          :aria-checked="modelValue === opt.value"
          @click.stop="select(opt.value)"
        >
          <AppIcon :name="SORT_ICONS[opt.value]" size="xs" />
          <span>{{ opt.label }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.sort-picker {
  display: inline-flex;
  flex-shrink: 0;
}

.trigger {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: $text-muted;
  line-height: 1;

  &:hover,
  &.open {
    color: $text;
    background: rgba(0, 0, 0, 0.05);
  }

  &.active {
    color: $primary;
    background: $primary-light;
  }
}

.sort-tooltip {
  position: fixed;
  z-index: 1400;
  max-width: 220px;
  padding: 6px 10px;
  background: $text;
  color: white;
  font-size: 12px;
  line-height: 1.4;
  border-radius: 6px;
  box-shadow: $shadow-lg;
  pointer-events: none;
}

.sort-menu {
  position: fixed;
  z-index: 1400;
  min-width: 180px;
  background: $surface;
  border: 1px solid $border;
  border-radius: $radius-sm;
  box-shadow: $shadow-lg;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sort-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: $text;
  text-align: left;

  &:hover {
    background: $bg;
  }

  &.active {
    color: $primary;
    background: $primary-light;
    font-weight: 600;
  }
}
</style>
