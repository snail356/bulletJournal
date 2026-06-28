<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <label class="app-switch" @click.prevent="emit('update:modelValue', !modelValue)">
    <span class="track" :class="{ on: modelValue }">
      <span class="thumb" />
    </span>
    <span v-if="label" class="label">{{ label }}</span>
  </label>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.app-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
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
