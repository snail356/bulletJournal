<script setup lang="ts">
import { onUnmounted, watch } from 'vue'

const props = defineProps<{
  message: string
  visible: boolean
}>()

const emit = defineEmits<{
  undo: []
  close: []
}>()

let timer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.visible,
  (v) => {
    if (timer) clearTimeout(timer)
    if (v) {
      timer = setTimeout(() => emit('close'), 4000)
    }
  },
)

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})

function undo() {
  if (timer) clearTimeout(timer)
  emit('undo')
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="visible" class="toast">
        <span>{{ message }}</span>
        <button type="button" @click="undo">復原</button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3000;
  background: #1f2937;
  color: white;
  padding: 12px 16px;
  border-radius: $radius-sm;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: $shadow-lg;
  font-size: 13px;

  button {
    color: #a78bfa;
    font-weight: 600;

    &:hover {
      color: #c4b5fd;
    }
  }
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
