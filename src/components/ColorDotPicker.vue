<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

export interface ColorDotOption {
  value: string
  color: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: ColorDotOption[]
    menuAlign?: 'start' | 'end'
  }>(),
  { menuAlign: 'start' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})

const currentColor = computed(
  () => props.options.find((o) => o.value === props.modelValue)?.color ?? props.modelValue,
)

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

  let left =
    props.menuAlign === 'end' ? trigger.right - menu.width : trigger.left
  // 不讓選單超出視窗左右邊界
  left = Math.max(8, Math.min(left, window.innerWidth - menu.width - 8))

  let top = trigger.bottom + 6
  if (top + menu.height > window.innerHeight - 8) {
    top = trigger.top - menu.height - 6
  }

  menuStyle.value = { left: `${left}px`, top: `${top}px` }
}

function select(value: string) {
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
  <div ref="rootRef" class="color-dot-picker">
    <button
      type="button"
      class="trigger-dot"
      :style="{ background: currentColor }"
      title="選擇顏色"
      @click.stop="toggle"
    />

    <Teleport to="body">
      <div v-if="open" ref="menuRef" class="color-dot-menu" :style="menuStyle">
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          class="color-dot"
          :class="{ active: modelValue === opt.value }"
          :style="{ background: opt.color }"
          @click.stop="select(opt.value)"
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.color-dot-picker {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.trigger-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 0 1px $border;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.1s;

  &:hover {
    transform: scale(1.1);
  }
}

.color-dot-menu {
  position: fixed;
  z-index: 1400;
  display: flex;
  gap: 6px;
  background: white;
  padding: 6px 8px;
  border-radius: 6px;
  box-shadow: $shadow;
  border: 1px solid $border;
}

.color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 0 1px $border;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.1s;

  &:hover {
    transform: scale(1.1);
  }

  &.active {
    box-shadow: 0 0 0 2px $primary;
  }
}
</style>
