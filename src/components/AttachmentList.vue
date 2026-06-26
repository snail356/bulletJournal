<script setup lang="ts">
import { ref } from 'vue'
import type { Attachment } from '@/types'
import { useTaskStore } from '@/stores/taskStore'

defineProps<{
  attachments: Attachment[]
}>()

const emit = defineEmits<{
  preview: [attachment: Attachment]
}>()

const store = useTaskStore()
const hoveredId = ref<string | null>(null)

function remove(id: string) {
  store.deleteAttachment(id)
}
</script>

<template>
  <div v-if="attachments.length" class="attachment-list">
    <div
      v-for="att in attachments"
      :key="att.id"
      class="thumb"
      @mouseenter="hoveredId = att.id"
      @mouseleave="hoveredId = null"
    >
      <img
        :src="att.thumbnailUrl"
        :alt="att.fileName"
        @click="emit('preview', att)"
      />
      <button
        v-show="hoveredId === att.id"
        type="button"
        class="remove"
        aria-label="刪除圖片"
        @click.stop="remove(att.id)"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.thumb {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: $radius-sm;
  overflow: hidden;
  border: 1px solid $border;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  color: white;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #ef4444;
  }
}
</style>
