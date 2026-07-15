<script setup lang="ts">
import { ref } from 'vue'
import type { Attachment, Note } from '@/types'
import AttachmentList from './AttachmentList.vue'
import ColorDotPicker from './ColorDotPicker.vue'
import AppIcon from './AppIcon.vue'
import InlineEditable from './InlineEditable.vue'
import { useTaskStore } from '@/stores/taskStore'
import { NOTE_COLOR_BG, NOTE_COLOR_DOT, NOTE_COLOR_OPTIONS } from '@/utils/noteColors'

const props = defineProps<{
  note: Note
  taskId: string
}>()

const emit = defineEmits<{
  preview: [attachment: Attachment]
}>()

const store = useTaskStore()
const fileInput = ref<HTMLInputElement | null>(null)
const contentRef = ref<InstanceType<typeof InlineEditable> | null>(null)

function saveContent(content: string) {
  store.updateNote(props.taskId, props.note.id, { content })
}

function remove() {
  store.deleteNote(props.taskId, props.note.id)
}

function setColor(color: string) {
  store.updateNote(props.taskId, props.note.id, { color: color as Note['color'] })
}

async function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      e.stopPropagation()
      const file = item.getAsFile()
      if (file) await store.addAttachment('note', props.note.id, file)
    }
  }
}

function triggerUpload() {
  fileInput.value?.click()
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await store.addAttachment('note', props.note.id, file)
  input.value = ''
}
</script>

<template>
  <div
    class="note"
    :style="{
      background: NOTE_COLOR_BG[note.color],
      borderColor: NOTE_COLOR_DOT[note.color],
    }"
    @paste="onPaste"
    @contextmenu.prevent
  >
    <div class="actions-anchor">
      <div class="actions">
        <button type="button" title="編輯" @click="contentRef?.startEditing()">
          <AppIcon name="pen" size="xs" />
        </button>
        <button type="button" title="貼上圖片" @click="triggerUpload">
          <AppIcon name="image" size="xs" />
        </button>
        <ColorDotPicker
          :model-value="note.color"
          :options="NOTE_COLOR_OPTIONS"
          menu-align="end"
          @update:model-value="setColor"
        />
        <button type="button" title="刪除" @click="remove">
          <AppIcon name="trash" size="xs" />
        </button>
      </div>
    </div>

    <InlineEditable
      ref="contentRef"
      :model-value="note.content"
      tag="p"
      class="content"
      multiline
      @save="saveContent"
    />

    <AttachmentList
      :attachments="note.attachments"
      @preview="emit('preview', $event)"
    />

    <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.note {
  position: relative;
  padding: 12px;
  // 右側預留 hover 操作列空間，避免 icon 蓋住備註文字
  padding-right: 120px;
  border-radius: $radius-sm;
  border-left: 3px solid;
  margin-top: 8px;

  &:hover .actions,
  .actions:focus-within {
    opacity: 1;
    pointer-events: auto;
  }
}

.content {
  font-size: 13px;
  white-space: pre-wrap;
  line-height: 1.6;
}

// 高度為 0 的 sticky 錨點：備註很長時操作列會跟著捲動、停留在可視範圍內
.actions-anchor {
  position: sticky;
  top: 8px;
  height: 0;
  z-index: 2;
}

.actions {
  position: absolute;
  top: -4px;
  right: -112px; // 對齊 .note 預留的右側 padding 區
  display: flex;
  gap: 2px;
  align-items: center;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 6px;
  padding: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;

  button {
    width: 26px;
    height: 26px;
    border-radius: 4px;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &:hover {
      background: white;
    }
  }
}

@media (max-width: $breakpoint-sm) {
  .note {
    padding-right: 12px;
    padding-top: 44px;
  }

  .actions {
    top: -36px;
    right: 0;
    opacity: 1;
    pointer-events: auto;
    background: transparent;
  }
}
</style>
