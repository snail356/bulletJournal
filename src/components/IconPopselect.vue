<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import type { AppIconName } from '@/plugins/fontawesome'

const props = withDefaults(
  defineProps<{
    modelValue: AppIconName
    options: AppIconName[]
    title?: string
  }>(),
  { title: '選擇圖示' },
)

const emit = defineEmits<{
  'update:modelValue': [value: AppIconName]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})

async function toggle() {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    updateMenuPosition()
  }
}

function updateMenuPosition() {
  const trigger = rootRef.value?.getBoundingClientRect()
  const menu = menuRef.value?.getBoundingClientRect()
  if (!trigger || !menu) return

  let left = trigger.left
  left = Math.max(8, Math.min(left, window.innerWidth - menu.width - 8))

  let top = trigger.bottom + 6
  if (top + menu.height > window.innerHeight - 8) {
    top = trigger.top - menu.height - 6
  }

  menuStyle.value = { left: `${left}px`, top: `${top}px` }
}

function select(value: AppIconName) {
  emit('update:modelValue', value)
  open.value = false
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (rootRef.value?.contains(target) || menuRef.value?.contains(target)) return
  open.value = false
}

function closeOnScroll() {
  if (open.value) open.value = false
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
  <div ref="rootRef" class="icon-popselect">
    <button
      type="button"
      class="trigger"
      :class="{ open }"
      :title="title"
      :aria-label="title"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click.stop="toggle"
    >
      <AppIcon :name="modelValue" size="xs" />
      <AppIcon name="chevron-down" size="xs" class="chevron" :class="{ open }" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menuRef"
        class="icon-popselect-menu"
        role="listbox"
        :style="menuStyle"
      >
        <button
          v-for="icon in options"
          :key="icon"
          type="button"
          class="option"
          :class="{ active: modelValue === icon }"
          role="option"
          :aria-selected="modelValue === icon"
          :aria-label="icon"
          @click.stop="select(icon)"
        >
          <AppIcon :name="icon" size="xs" />
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.icon-popselect {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.trigger {
  height: 32px;
  padding: 0 8px 0 10px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  color: $text-muted;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &:hover,
  &.open {
    border-color: $primary;
    color: $primary;
    background: $primary-light;
  }
}

.chevron {
  font-size: 10px;
  transition: transform 0.15s;

  &.open {
    transform: rotate(180deg);
  }
}

.icon-popselect-menu {
  position: fixed;
  z-index: 1400;
  display: grid;
  grid-template-columns: repeat(5, 32px);
  gap: 6px;
  padding: 8px;
  background: $surface;
  border: 1px solid $border;
  border-radius: $radius-sm;
  box-shadow: $shadow-lg;
}

.option {
  width: 32px;
  height: 32px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  color: $text-muted;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    border-color: $primary;
    color: $primary;
  }

  &.active {
    border-color: $primary;
    background: $primary-light;
    color: $primary;
  }
}
</style>
