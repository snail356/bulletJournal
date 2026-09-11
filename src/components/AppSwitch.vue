<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  label?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function onToggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    class="app-switch"
    role="switch"
    :class="{ disabled }"
    :aria-checked="modelValue ? 'true' : 'false'"
    :aria-disabled="disabled ? 'true' : undefined"
    :disabled="disabled"
    @click.stop="onToggle"
    @pointerdown.stop
  >
    <span class="track" :class="{ on: modelValue }" aria-hidden="true">
      <span class="thumb" />
    </span>
    <span v-if="label" class="label">{{ label }}</span>
  </button>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.app-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 4px;
  margin: -4px;
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
  font: inherit;
  color: inherit;
  background: none;
  border: none;

  &.disabled,
  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
}

.track {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: #d1d5db;
  transition: background 0.2s;
  flex-shrink: 0;

  &.on {
    background: $primary;
  }
}

.thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;

  .on & {
    transform: translateX(16px);
  }
}

.label {
  font-size: 13px;
  color: $text-muted;
  white-space: nowrap;
}
</style>
