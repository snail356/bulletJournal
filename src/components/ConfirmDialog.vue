<script setup lang="ts">
withDefaults(
  defineProps<{
    visible: boolean
    title: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
  }>(),
  {
    message: '',
    confirmLabel: '是',
    cancelLabel: '否',
    danger: false,
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
  close: []
}>()

function onCancel() {
  emit('cancel')
  emit('close')
}

function onConfirm() {
  emit('confirm')
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay" @click.self="onCancel">
      <div class="panel" role="dialog" aria-modal="true" :aria-labelledby="title">
        <h3 class="title">{{ title }}</h3>
        <p v-if="message" class="message">{{ message }}</p>
        <div class="actions">
          <button type="button" class="cancel" @click="onCancel">
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="confirm"
            :class="{ danger }"
            @click="onConfirm"
          >
            {{ confirmLabel }}
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
  z-index: 1500;
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
}

.title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.message {
  margin-top: 10px;
  font-size: 13px;
  color: $text-muted;
  line-height: 1.6;
  white-space: pre-wrap;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
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

  &.danger {
    background: #ef4444;

    &:hover {
      background: #dc2626;
    }
  }
}
</style>
