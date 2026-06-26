<script setup lang="ts">
import { ref } from 'vue'
import type { Attachment, Note } from '@/types'
import AttachmentList from './AttachmentList.vue'
import { useTaskStore } from '@/stores/taskStore'

const props = defineProps<{
  note: Note
  taskId: string
}>()

const emit = defineEmits<{
  preview: [attachment: Attachment]
}>()

const store = useTaskStore()
const editing = ref(false)
const editContent = ref('')
const hovered = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const showColorPicker = ref(false)

const colors: Note['color'][] = ['purple', 'orange', 'green', 'blue', 'gray']

const colorMap: Record<Note['color'], string> = {
  purple: '#ede9fe',
  orange: '#ffedd5',
  green: '#dcfce7',
  blue: '#dbeafe',
  gray: '#f3f4f6',
}

const borderMap: Record<Note['color'], string> = {
  purple: '#c4b5fd',
  orange: '#fdba74',
  green: '#86efac',
  blue: '#93c5fd',
  gray: '#d1d5db',
}

function startEdit() {
  editContent.value = props.note.content
  editing.value = true
}

function saveEdit() {
  if (editContent.value.trim()) {
    store.updateNote(props.taskId, props.note.id, { content: editContent.value.trim() })
  }
  editing.value = false
}

function remove() {
  store.deleteNote(props.taskId, props.note.id)
}

function setColor(color: Note['color']) {
  store.updateNote(props.taskId, props.note.id, { color })
  showColorPicker.value = false
}

async function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
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
      background: colorMap[note.color],
      borderColor: borderMap[note.color],
    }"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false; showColorPicker = false"
    @paste="onPaste"
    @contextmenu.prevent
  >
    <textarea
      v-if="editing"
      v-model="editContent"
      class="edit-area"
      @blur="saveEdit"
    />
    <p v-else class="content">{{ note.content }}</p>

    <AttachmentList
      :attachments="note.attachments"
      @preview="emit('preview', $event)"
    />

    <div v-show="hovered" class="actions">
      <button type="button" title="編輯" @click="startEdit">✏️</button>
      <button type="button" title="貼上圖片" @click="triggerUpload">🖼️</button>
      <button type="button" title="改變顏色" @click="showColorPicker = !showColorPicker">🎨</button>
      <button type="button" title="刪除" @click="remove">🗑️</button>
    </div>

    <div v-if="showColorPicker" class="color-picker">
      <button
        v-for="c in colors"
        :key="c"
        type="button"
        class="color-dot"
        :style="{ background: borderMap[c] }"
        @click="setColor(c)"
      />
    </div>

    <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.note {
  position: relative;
  padding: 12px;
  border-radius: $radius-sm;
  border-left: 3px solid;
  margin-top: 8px;
}

.content {
  font-size: 13px;
  white-space: pre-wrap;
  line-height: 1.6;
}

.edit-area {
  width: 100%;
  min-height: 60px;
  padding: 6px;
  border: 1px solid $primary;
  border-radius: 4px;
  background: white;
  resize: vertical;
}

.actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 2px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 6px;
  padding: 2px;

  button {
    width: 26px;
    height: 26px;
    border-radius: 4px;
    font-size: 12px;

    &:hover {
      background: white;
    }
  }
}

.color-picker {
  position: absolute;
  top: 36px;
  right: 8px;
  display: flex;
  gap: 6px;
  background: white;
  padding: 6px 8px;
  border-radius: 6px;
  box-shadow: $shadow;
}

.color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 0 1px $border;
}
</style>
