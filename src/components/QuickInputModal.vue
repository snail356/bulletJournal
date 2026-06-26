<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  title: string
  placeholder?: string
  multiline?: boolean
  confirmLabel?: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [value: string]
}>()

const value = ref('')
const inputRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      value.value = ''
      setTimeout(() => inputRef.value?.focus(), 50)
    }
  },
)

function confirm() {
  const trimmed = value.value.trim()
  if (!trimmed) return
  emit('confirm', trimmed)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay" @click.self="emit('close')">
      <div class="panel">
        <h3>{{ title }}</h3>
        <textarea
          v-if="multiline"
          ref="inputRef"
          v-model="value"
          :placeholder="placeholder"
          rows="4"
        />
        <input
          v-else
          ref="inputRef"
          v-model="value"
          type="text"
          :placeholder="placeholder"
          @keyup.enter="confirm"
        />
        <div class="actions">
          <button type="button" class="cancel" @click="emit('close')">取消</button>
          <button type="button" class="confirm" @click="confirm">
            {{ confirmLabel ?? '確認' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.overlay {
  position: fixed;
  inset: 0;
  z-index: 1400;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.panel {
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow-lg;
  padding: 20px;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  h3 {
    font-size: 15px;
    font-weight: 600;
  }

  input,
  textarea {
    padding: 10px 12px;
    border: 1px solid $border;
    border-radius: $radius-sm;
    resize: vertical;

    &:focus {
      outline: none;
      border-color: $primary;
      box-shadow: 0 0 0 3px $primary-light;
    }
  }
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.cancel {
  padding: 8px 14px;
  color: $text-muted;
  border-radius: $radius-sm;

  &:hover {
    background: $bg;
  }
}

.confirm {
  padding: 8px 16px;
  background: $primary;
  color: white;
  border-radius: $radius-sm;
  font-weight: 600;

  &:hover {
    background: $primary-dark;
  }
}
</style>
