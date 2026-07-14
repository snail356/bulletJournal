<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Attachment } from '@/types'
import AppIcon from './AppIcon.vue'
import { useTaskStore } from '@/stores/taskStore'

defineProps<{
  attachments: Attachment[]
}>()

const emit = defineEmits<{
  preview: [attachment: Attachment]
}>()

const store = useTaskStore()
const hoveredId = ref<string | null>(null)
const expanded = computed(() => store.expandImages)

function remove(id: string) {
  store.deleteAttachment(id)
}

function onImageClick(att: Attachment) {
  if (!expanded.value) emit('preview', att)
}
</script>

<template>
  <div
    v-if="attachments.length"
    class="attachment-list"
    :class="{ expanded }"
  >
    <div
      v-for="att in attachments"
      :key="att.id"
      class="thumb"
      @mouseenter="hoveredId = att.id"
      @mouseleave="hoveredId = null"
    >
      <div class="img-wrap">
        <img
          :src="expanded ? att.url : att.thumbnailUrl"
          :alt="att.fileName"
          @click="onImageClick(att)"
        />
        <button
          v-show="hoveredId === att.id"
          type="button"
          class="remove"
          aria-label="刪除圖片"
          @click.stop="remove(att.id)"
        >
          <AppIcon name="xmark" size="xs" />
        </button>
      </div>
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
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;

  &.expanded {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;

    .thumb {
      cursor: default;
      width: 100%;
      max-width: 320px;
      min-width: 0;
      box-sizing: border-box;
    }

    .img-wrap {
      display: block;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .img-wrap img {
      width: 100%;
      height: auto;
      max-width: 100%;
      max-height: 240px;
      object-fit: contain;
      object-position: left center;
    }
  }
}

.thumb {
  flex-shrink: 0;
  border-radius: $radius-sm;
  cursor: pointer;
}

.img-wrap {
  position: relative;
  display: inline-block;
  line-height: 0;
  border-radius: $radius-sm;
  overflow: hidden;
  border: 1px solid $border;

  img {
    display: block;
    width: 72px;
    height: 72px;
    object-fit: cover;
  }
}

.remove {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover {
    background: #ef4444;
  }
}
</style>
