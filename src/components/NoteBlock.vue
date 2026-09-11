<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Attachment, ContentFormat, Note } from '@/types'
import AttachmentList from './AttachmentList.vue'
import ColorDotPicker from './ColorDotPicker.vue'
import AppIcon from './AppIcon.vue'
import DeleteIconButton from './DeleteIconButton.vue'
import FormattedContentEditor from './FormattedContentEditor.vue'
import { useTaskStore } from '@/stores/taskStore'
import { resolveContentType } from '@/utils/detectContentType'
import { NOTE_COLOR_BG, NOTE_COLOR_DOT, NOTE_COLOR_OPTIONS } from '@/utils/noteColors'
import { getNoteCollapsed, setNoteCollapsed } from '@/utils/sectionCollapseState'

const props = defineProps<{
  note: Note
  taskId: string
  autofocus?: boolean
}>()

const emit = defineEmits<{
  preview: [attachment: Attachment]
}>()

const store = useTaskStore()
const fileInput = ref<HTMLInputElement | null>(null)
const editorRef = ref<InstanceType<typeof FormattedContentEditor> | null>(null)
const noteEl = ref<HTMLElement | null>(null)
const keepAlive = ref(false)
const editing = ref(false)

const isFormatted = computed(
  () => props.note.contentType === 'code' || props.note.contentType === 'markdown',
)

function shouldStartCollapsed(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  return trimmed.includes('\n') || trimmed.length > 80
}

const collapsed = ref(
  getNoteCollapsed(props.note.id, shouldStartCollapsed(props.note.content)),
)

watch(collapsed, (value) => {
  setNoteCollapsed(props.note.id, value)
})

watch(
  () => props.note.id,
  (noteId) => {
    collapsed.value = getNoteCollapsed(
      noteId,
      shouldStartCollapsed(props.note.content),
    )
  },
)

watch(
  () => props.autofocus,
  (value) => {
    if (!value) return
    collapsed.value = false
    nextTick(() => editorRef.value?.startEditing())
  },
  { immediate: true },
)

const oneLinePreview = computed(() => {
  const text = props.note.content.trim().replace(/\s+/g, ' ')
  if (!text) return '（空白備註）'
  return text.length > 72 ? `${text.slice(0, 72)}…` : text
})

function saveContent(content: string, contentType: ContentFormat) {
  if (!content.trim() && !props.note.attachments.length) {
    const pointerKeep = keepAlive.value
    nextTick(() => {
      if (pointerKeep || noteEl.value?.contains(document.activeElement)) {
        store.updateNote(props.taskId, props.note.id, {
          content: '',
          contentType: 'text',
        })
        return
      }
      store.deleteNote(props.taskId, props.note.id)
    })
    return
  }

  store.updateNote(props.taskId, props.note.id, { content, contentType })
  collapsed.value = shouldStartCollapsed(content)
}

function remove() {
  store.deleteNote(props.taskId, props.note.id)
}

function setColor(color: string) {
  store.updateNote(props.taskId, props.note.id, { color: color as Note['color'] })
}

function convertToText() {
  store.updateNote(props.taskId, props.note.id, { contentType: 'text' })
}

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}

async function startEditing() {
  collapsed.value = false
  await nextTick()
  editorRef.value?.startEditing()
}

function onNotePointerDown() {
  keepAlive.value = true
  requestAnimationFrame(() => {
    keepAlive.value = false
  })
}

async function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (items) {
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        e.stopPropagation()
        collapsed.value = false
        const file = item.getAsFile()
        if (file) await store.addAttachment('note', props.note.id, file)
        return
      }
    }
  }

  if (!collapsed.value) return

  const text = e.clipboardData?.getData('text/plain') ?? ''
  if (!text.trim()) return

  const contentType = resolveContentType(text)
  if (contentType === 'text') return

  e.preventDefault()
  e.stopPropagation()
  store.updateNote(props.taskId, props.note.id, {
    content: text.replace(/\n$/, ''),
    contentType,
  })
  collapsed.value = shouldStartCollapsed(text)
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

async function onPasteImage(file: File) {
  collapsed.value = false
  await store.addAttachment('note', props.note.id, file)
}

function formatTag(type: ContentFormat): string | null {
  if (type === 'code') return 'code'
  if (type === 'markdown') return 'md'
  return null
}
</script>

<template>
  <div
    ref="noteEl"
    class="note"
    :class="{
      'is-formatted': isFormatted && !collapsed,
      collapsed,
      'is-editing': editing,
    }"
    :style="{
      background: NOTE_COLOR_BG[note.color],
      borderColor: NOTE_COLOR_DOT[note.color],
    }"
    @pointerdown="onNotePointerDown"
    @paste="onPaste"
    @contextmenu.stop
  >
    <div class="actions-anchor">
      <div class="actions">
        <button
          type="button"
          :title="collapsed ? '展開備註' : '收合為一行'"
          :aria-expanded="!collapsed"
          @click="toggleCollapsed"
        >
          <AppIcon
            :name="collapsed ? 'chevron-right' : 'chevron-down'"
            size="xs"
          />
        </button>
        <button type="button" title="編輯" @click="startEditing">
          <AppIcon name="pen" size="xs" />
        </button>
        <button
          v-if="isFormatted"
          type="button"
          title="轉為一般文字"
          @click="convertToText"
        >
          <AppIcon name="file-lines" size="xs" />
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
        <DeleteIconButton
          title="刪除備註"
          message="確定刪除此備註？"
          @confirm="remove"
        />
      </div>
    </div>

    <button
      v-if="collapsed"
      type="button"
      class="one-line-preview"
      :title="oneLinePreview"
      @click="collapsed = false"
    >
      <span v-if="formatTag(note.contentType)" class="format-tag">
        {{ formatTag(note.contentType) }}
      </span>
      <span class="preview-text">{{ oneLinePreview }}</span>
    </button>
    <template v-else>
      <FormattedContentEditor
        ref="editorRef"
        :content="note.content"
        :content-type="note.contentType"
        placeholder="輸入備註或目前進度…"
        preview-until-edit
        borderless
        :show-formatted-actions="false"
        @commit="saveContent"
        @convert-to-text="convertToText"
        @paste-image="onPasteImage"
        @editing-change="editing = $event"
      />

      <AttachmentList
        :attachments="note.attachments"
        @preview="emit('preview', $event)"
      />
    </template>

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
  overflow: visible;

  &:hover .actions,
  .actions:focus-within {
    opacity: 1;
    pointer-events: auto;
  }

  &.collapsed {
    padding-top: 8px;
    padding-bottom: 8px;
  }

  &.is-editing::before {
    content: '';
    position: absolute;
    top: 12px;
    left: -20px;
    z-index: 2;
    width: 12px;
    height: 12px;
    pointer-events: none;
    background: no-repeat center / contain;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c3aed'%3E%3Cpath d='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'/%3E%3C/svg%3E");
  }
}

.one-line-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  text-align: left;
  font-size: 13px;
  line-height: 1.5;
  color: $text;
  cursor: pointer;

  &:hover .preview-text {
    color: $primary;
  }
}

.preview-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.format-tag {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  padding: 1px 5px;
  border-radius: 4px;
  color: #e5e7eb;
  background: #1f2937;
}

.actions-anchor {
  position: sticky;
  top: 8px;
  height: 0;
  z-index: 2;
}

.actions {
  position: absolute;
  top: -4px;
  right: 0;
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
    padding-top: 44px;

    &.collapsed {
      padding-top: 44px;
    }

    &.is-editing::before {
      top: -16px;
      left: 8px;
    }
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
