<script setup lang="ts">
import { ref } from 'vue'
import type { Attachment, SubTask } from '@/types'
import AttachmentList from './AttachmentList.vue'
import { useTaskStore } from '@/stores/taskStore'

const props = defineProps<{
  subtask: SubTask
  taskId: string
}>()

const emit = defineEmits<{
  preview: [attachment: Attachment]
}>()

const store = useTaskStore()
const editing = ref(false)
const editTitle = ref('')
const hovered = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function startEdit() {
  editTitle.value = props.subtask.title
  editing.value = true
}

function saveEdit() {
  if (editTitle.value.trim()) {
    store.updateSubTask(props.taskId, props.subtask.id, { title: editTitle.value.trim() })
  }
  editing.value = false
}

function toggle() {
  store.toggleSubTask(props.taskId, props.subtask.id)
}

function remove() {
  store.deleteSubTask(props.taskId, props.subtask.id)
}

async function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) await store.addAttachment('subtask', props.subtask.id, file)
    }
  }
}

function triggerUpload() {
  fileInput.value?.click()
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await store.addAttachment('subtask', props.subtask.id, file)
  input.value = ''
}
</script>

<template>
  <div
    class="subtask"
    :class="{ completed: subtask.completed }"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @paste="onPaste"
    @contextmenu.prevent
  >
    <label class="check-wrap">
      <input type="checkbox" :checked="subtask.completed" @change="toggle" />
      <span class="check" />
    </label>

    <div class="body">
      <input
        v-if="editing"
        v-model="editTitle"
        class="edit-input"
        @blur="saveEdit"
        @keyup.enter="saveEdit"
      />
      <span v-else class="title">{{ subtask.title }}</span>
      <AttachmentList
        :attachments="subtask.attachments"
        @preview="emit('preview', $event)"
      />
    </div>

    <div v-show="hovered" class="actions">
      <button type="button" title="編輯" @click="startEdit">✏️</button>
      <button type="button" title="貼上圖片" @click="triggerUpload">🖼️</button>
      <button type="button" title="刪除" @click="remove">🗑️</button>
    </div>

    <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.subtask {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 8px 8px 4px;
  border-radius: $radius-sm;
  transition: background 0.15s;

  &:hover {
    background: $bg;
  }

  &.completed .title {
    color: $text-muted;
    text-decoration: line-through;
    opacity: 0.65;
  }
}

.check-wrap {
  display: flex;
  align-items: center;
  padding-top: 2px;
  cursor: pointer;

  input {
    display: none;
  }
}

.check {
  width: 16px;
  height: 16px;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  display: block;
  position: relative;
}

input:checked + .check {
  background: $primary;
  border-color: $primary;

  &::after {
    content: '✓';
    position: absolute;
    inset: 0;
    color: white;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.body {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 13px;
}

.edit-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid $primary;
  border-radius: 4px;
}

.actions {
  display: flex;
  gap: 2px;

  button {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    font-size: 13px;

    &:hover {
      background: $surface;
    }
  }
}
</style>
