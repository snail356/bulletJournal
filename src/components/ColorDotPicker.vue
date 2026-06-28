<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

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

const currentColor = computed(
  () => props.options.find((o) => o.value === props.modelValue)?.color ?? props.modelValue,
)

function toggle() {
  open.value = !open.value
}

function select(value: string) {
  emit('update:modelValue', value)
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
  <div ref="rootRef" class="color-dot-picker">
    <button
      type="button"
      class="trigger-dot"
      :style="{ background: currentColor }"
      title="選擇顏色"
      @click.stop="toggle"
    />

    <div v-if="open" class="menu" :class="menuAlign">
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

.menu {
  position: absolute;
  top: calc(100% + 6px);
  z-index: 100;
  display: flex;
  gap: 6px;
  background: white;
  padding: 6px 8px;
  border-radius: 6px;
  box-shadow: $shadow;
  border: 1px solid $border;

  &.start {
    left: 0;
  }

  &.end {
    right: 0;
  }
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
