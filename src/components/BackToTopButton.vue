<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    /** 滾動容器；未傳入時自動尋找最近的可滾動祖先 */
    target?: HTMLElement | null
    threshold?: number
    /** 固定於視窗右下角（頁面級捲動）；預設為相對定位父層內 */
    fixed?: boolean
  }>(),
  {
    threshold: 200,
    fixed: false,
  },
)

const locatorRef = ref<HTMLElement | null>(null)
const visible = ref(false)

let bound: HTMLElement | Window | null = null

function isWindow(el: HTMLElement | Window): el is Window {
  return el === window
}

function getScrollTop(el: HTMLElement | Window): number {
  return isWindow(el) ? el.scrollY : el.scrollTop
}

function getScrollParent(el: HTMLElement | null): HTMLElement | Window {
  let node = el?.parentElement ?? null
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return node
    }
    node = node.parentElement
  }
  return window
}

function onScroll() {
  if (!bound) return
  visible.value = getScrollTop(bound) > props.threshold
}

function unbind() {
  if (!bound) return
  bound.removeEventListener('scroll', onScroll)
  bound = null
}

function bind(el: HTMLElement | Window) {
  if (bound === el) {
    onScroll()
    return
  }
  unbind()
  bound = el
  bound.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}

function resolveTarget(): HTMLElement | Window | null {
  if (props.target) return props.target
  if (props.target === null) return null
  return getScrollParent(locatorRef.value)
}

function attach() {
  const el = resolveTarget()
  if (el) bind(el)
  else {
    unbind()
    visible.value = false
  }
}

function scrollToTop() {
  if (!bound) return
  bound.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(() => props.target, attach)

onMounted(() => {
  attach()
  window.addEventListener('resize', attach)
})

onUnmounted(() => {
  unbind()
  window.removeEventListener('resize', attach)
})
</script>

<template>
  <span ref="locatorRef" class="back-to-top-locator" aria-hidden="true" />
  <Teleport to="body" :disabled="!fixed">
    <Transition name="back-to-top">
      <button
        v-if="visible"
        type="button"
        class="back-to-top"
        :class="{ 'is-fixed': fixed }"
        aria-label="回到最上方"
        @click="scrollToTop"
      >
        <AppIcon name="arrow-up" size="sm" />
      </button>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.back-to-top-locator {
  display: none;
}

.back-to-top {
  position: absolute;
  right: 20px;
  bottom: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: $primary;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-lg;
  z-index: 5;

  &:hover {
    background: $primary-dark;
  }

  &.is-fixed {
    position: fixed;
    right: 40px;
    bottom: 32px;
    z-index: 40;
  }
}

.back-to-top-enter-active,
.back-to-top-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.back-to-top-enter-from,
.back-to-top-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (max-width: $breakpoint-md) {
  .back-to-top.is-fixed {
    right: 16px;
    bottom: 20px;
  }
}
</style>
