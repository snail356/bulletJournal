<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import type { AppIconName } from '@/plugins/fontawesome'

const props = withDefaults(
  defineProps<{
    icon: AppIconName
    label: string
    active?: boolean
    disabled?: boolean
    danger?: boolean
    variant?: 'default' | 'overlay'
  }>(),
  { active: false, disabled: false, danger: false, variant: 'default' },
)

const emit = defineEmits<{
  click: []
}>()

const rootRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const open = ref(false)
const popoverStyle = ref<Record<string, string>>({})

async function showPopover() {
  open.value = true
  await nextTick()
  updatePosition()
}

function hidePopover() {
  open.value = false
}

function updatePosition() {
  const trigger = rootRef.value?.getBoundingClientRect()
  const popover = popoverRef.value?.getBoundingClientRect()
  if (!trigger || !popover) return

  let left = trigger.left + trigger.width / 2 - popover.width / 2
  left = Math.max(8, Math.min(left, window.innerWidth - popover.width - 8))

  let top = trigger.top - popover.height - 8
  if (top < 8) top = trigger.bottom + 8

  popoverStyle.value = { left: `${left}px`, top: `${top}px` }
}

function onClick() {
  if (props.disabled) return
  hidePopover()
  emit('click')
}

function closeOnScroll() {
  if (open.value) hidePopover()
}

onMounted(() => {
  window.addEventListener('scroll', closeOnScroll, true)
  window.addEventListener('resize', closeOnScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', closeOnScroll, true)
  window.removeEventListener('resize', closeOnScroll)
})
</script>

<template>
  <span class="popover-icon-wrap">
    <button
      ref="rootRef"
      type="button"
      class="popover-icon-btn"
      :class="{ active, disabled, danger, overlay: variant === 'overlay' }"
      :aria-label="label"
      :aria-pressed="disabled ? undefined : active"
      :aria-disabled="disabled ? 'true' : undefined"
      @click="onClick"
      @mouseenter="showPopover"
      @mouseleave="hidePopover"
      @focus="showPopover"
      @blur="hidePopover"
    >
      <AppIcon :name="icon" size="xs" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="popoverRef"
        class="icon-popover"
        role="tooltip"
        :style="popoverStyle"
      >
        {{ label }}
      </div>
    </Teleport>
  </span>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.popover-icon-wrap {
  display: inline-flex;
}

.popover-icon-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: $text-muted;
  line-height: 1;

  &:hover:not(.disabled) {
    color: $text;
    background: rgba(0, 0, 0, 0.05);
  }

  &.danger:hover:not(.disabled),
  &.danger:focus-visible:not(.disabled) {
    color: #ef4444;
    background: #fee2e2;
  }

  &.overlay {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.65);
    color: white;

    &:hover:not(.disabled),
    &.danger:hover:not(.disabled),
    &.danger:focus-visible:not(.disabled) {
      color: white;
      background: #ef4444;
    }
  }

  &.active {
    color: $primary;
    background: $primary-light;
  }

  &.disabled {
    cursor: default;
  }
}

.icon-popover {
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
  white-space: normal;
}
</style>
