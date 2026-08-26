<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

export interface ContextMenuItem {
  key: string
  label: string
  danger?: boolean
  divider?: boolean
  confirmTitle?: string
  confirmMessage?: string
  confirmLabel?: string
}

const props = defineProps<{
  items: ContextMenuItem[]
  x: number
  y: number
  visible: boolean
}>()

const emit = defineEmits<{
  select: [key: string]
  close: []
}>()

const menuRef = ref<HTMLElement | null>(null)
const pending = ref<ContextMenuItem | null>(null)
const confirmVisible = ref(false)

function onClickOutside(e: MouseEvent) {
  if (confirmVisible.value) return
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))

function style() {
  const maxX = window.innerWidth - 200
  const maxY = window.innerHeight - 300
  return {
    left: `${Math.min(props.x, maxX)}px`,
    top: `${Math.min(props.y, maxY)}px`,
  }
}

function onItemClick(item: ContextMenuItem) {
  if (item.confirmTitle) {
    pending.value = item
    confirmVisible.value = true
    emit('close')
    return
  }
  emit('select', item.key)
}

function onConfirmDelete() {
  if (!pending.value) return
  emit('select', pending.value.key)
  pending.value = null
}

function onConfirmClose() {
  confirmVisible.value = false
  pending.value = null
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" ref="menuRef" class="context-menu" :style="style()">
      <template v-for="item in items" :key="item.key">
        <hr v-if="item.divider" />
        <button
          type="button"
          :class="{ danger: item.danger }"
          @click="onItemClick(item)"
        >
          {{ item.label }}
        </button>
      </template>
    </div>
    <ConfirmDialog
      :visible="confirmVisible"
      :title="pending?.confirmTitle ?? '刪除'"
      :message="pending?.confirmMessage"
      :confirm-label="pending?.confirmLabel ?? '確定'"
      cancel-label="取消"
      danger
      @confirm="onConfirmDelete"
      @close="onConfirmClose"
    />
  </Teleport>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.context-menu {
  position: fixed;
  z-index: 1500;
  min-width: 180px;
  background: $surface;
  border-radius: $radius-sm;
  box-shadow: $shadow-lg;
  border: 1px solid $border;
  padding: 6px;
  display: flex;
  flex-direction: column;
}

button {
  text-align: left;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: $text;

  &:hover {
    background: $bg;
  }

  &.danger {
    color: #ef4444;

    &:hover {
      background: #fef2f2;
    }
  }
}

hr {
  border: none;
  border-top: 1px solid $border;
  margin: 4px 0;
}
</style>
