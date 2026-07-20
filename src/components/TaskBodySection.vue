<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Attachment, ContentFormat, Task } from '@/types'
import AttachmentList from './AttachmentList.vue'
import CodeSnippet from './CodeSnippet.vue'
import MarkdownContent from './MarkdownContent.vue'
import AppIcon from './AppIcon.vue'
import { useTaskStore } from '@/stores/taskStore'
import { resolveContentType } from '@/utils/detectContentType'

const props = defineProps<{
  taskId: string
  content: string
  contentType: Task['bodyContentType']
  attachments: Attachment[]
}>()

const emit = defineEmits<{
  preview: [attachment: Attachment]
}>()

const store = useTaskStore()
const expanded = ref(props.content.trim().length > 0 || props.attachments.length > 0)
const editingFormatted = ref(false)
const draft = ref(props.content)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const isCode = computed(() => props.contentType === 'code')
const isMarkdown = computed(() => props.contentType === 'markdown')
const isFormatted = computed(() => isCode.value || isMarkdown.value)
const hasContent = computed(() => props.content.trim().length > 0)
const showEditor = computed(() => !isFormatted.value || editingFormatted.value)

const preview = computed(() => {
  const text = props.content.trim().replace(/\s+/g, ' ')
  if (!text) {
    if (props.attachments.length) return `${props.attachments.length} 張圖片`
    return '尚無內容'
  }
  return text.length > 48 ? `${text.slice(0, 48)}…` : text
})

watch(
  () => props.content,
  (value) => {
    if (!showEditor.value || document.activeElement !== textareaRef.value) {
      draft.value = value
    }
  },
)

watch(showEditor, async (visible) => {
  if (!visible) return
  await nextTick()
  if (textareaRef.value) autoResize(textareaRef.value)
})

watch(expanded, async (value) => {
  if (!value || !showEditor.value) return
  await nextTick()
  if (textareaRef.value) autoResize(textareaRef.value)
})

function commitDraft() {
  const next = draft.value.replace(/\n$/, '')
  store.updateTask(props.taskId, {
    bodyContent: next,
    bodyContentType: resolveContentType(next),
  })
  editingFormatted.value = false
  draft.value = next
}

function convertToText() {
  store.updateTask(props.taskId, { bodyContentType: 'text' })
  editingFormatted.value = false
  draft.value = props.content
}

async function startEditFormatted() {
  editingFormatted.value = true
  draft.value = props.content
  await nextTick()
  const el = textareaRef.value
  if (!el) return
  el.focus()
  el.setSelectionRange(el.value.length, el.value.length)
  autoResize(el)
}

function toggleExpanded() {
  expanded.value = !expanded.value
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.max(el.scrollHeight, 72)}px`
}

function onInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  draft.value = el.value
  autoResize(el)
}

function applyPastedContent(text: string) {
  const contentType = resolveContentType(text)
  if (contentType === 'text') return false

  store.updateTask(props.taskId, {
    bodyContent: text.replace(/\n$/, ''),
    bodyContentType: contentType,
  })
  editingFormatted.value = false
  draft.value = text.replace(/\n$/, '')
  return true
}

async function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (items) {
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        e.stopPropagation()
        const file = item.getAsFile()
        if (file) {
          expanded.value = true
          await store.addAttachment('task', props.taskId, file)
        }
        return
      }
    }
  }

  const text = e.clipboardData?.getData('text/plain') ?? ''
  if (!text.trim()) return

  const contentType = resolveContentType(text)
  if (contentType === 'text') return

  if (!showEditor.value) {
    e.preventDefault()
    e.stopPropagation()
    applyPastedContent(text)
    return
  }

  nextTick(() => {
    const el = textareaRef.value
    if (!el) return
    draft.value = el.value
    autoResize(el)
    applyPastedContent(el.value)
  })
}

function triggerUpload() {
  expanded.value = true
  fileInput.value?.click()
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await store.addAttachment('task', props.taskId, file)
  input.value = ''
}

function onContextMenu(e: MouseEvent) {
  e.stopPropagation()
}

function formatTag(type: ContentFormat): string | null {
  if (type === 'code') return 'code'
  if (type === 'markdown') return 'md'
  return null
}
</script>

<template>
  <div
    class="section body-section"
    @paste="onPaste"
    @contextmenu="onContextMenu"
  >
    <div class="section-header">
      <button
        type="button"
        class="section-toggle"
        :aria-expanded="expanded"
        @click="toggleExpanded"
      >
        <AppIcon
          :name="expanded ? 'chevron-down' : 'chevron-right'"
          size="xs"
        />
        <p class="section-title">
          內容
          <span v-if="attachments.length" class="section-count">
            {{ attachments.length }}
          </span>
        </p>
      </button>
      <button
        type="button"
        class="upload-btn"
        title="貼上／上傳圖片"
        @click="triggerUpload"
      >
        <AppIcon name="image" size="xs" />
      </button>
    </div>

    <p
      v-if="!expanded"
      class="collapsed-preview"
      @click="expanded = true"
    >
      <span v-if="formatTag(contentType) && hasContent" class="format-tag">
        {{ formatTag(contentType) }}
      </span>
      {{ preview }}
    </p>

    <div v-else class="body-area">
      <div v-if="isCode && !editingFormatted" class="formatted-body">
        <div class="formatted-actions">
          <button type="button" title="編輯" @click="startEditFormatted">
            <AppIcon name="pen" size="xs" />
          </button>
          <button type="button" title="轉為一般文字" @click="convertToText">
            <AppIcon name="file-lines" size="xs" />
          </button>
        </div>
        <CodeSnippet :code="content" />
      </div>
      <div v-else-if="isMarkdown && !editingFormatted" class="formatted-body">
        <div class="formatted-actions">
          <button type="button" title="編輯" @click="startEditFormatted">
            <AppIcon name="pen" size="xs" />
          </button>
          <button type="button" title="轉為一般文字" @click="convertToText">
            <AppIcon name="file-lines" size="xs" />
          </button>
        </div>
        <MarkdownContent :content="content" />
      </div>
      <textarea
        v-else
        ref="textareaRef"
        class="body-textarea"
        :class="{ 'is-code': isCode }"
        :value="draft"
        rows="3"
        placeholder="輸入任務內容…"
        @input="onInput"
        @blur="commitDraft"
        @paste="onPaste"
        @contextmenu="onContextMenu"
      />

      <AttachmentList
        :attachments="attachments"
        @preview="emit('preview', $event)"
      />
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      hidden
      @change="onFileChange"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.body-section {
  margin-top: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.section-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: $text-muted;
  border-radius: 4px;
  padding: 2px 4px 2px 0;

  &:hover {
    color: $primary;
  }
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: inherit;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.section-count {
  margin-left: 6px;
  color: $primary;
  font-weight: 700;
}

.upload-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: $text-muted;

  &:hover {
    color: $primary;
    background: $bg;
  }
}

.collapsed-preview {
  margin-top: 4px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: $text-muted;
  background: $bg;
  border-radius: $radius-sm;
  border-left: 3px solid $border;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: $text;
    border-left-color: $primary;
  }
}

.format-tag {
  display: inline-block;
  margin-right: 6px;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b7280;
  background: #e5e7eb;
  vertical-align: middle;
}

.body-area {
  min-width: 0;
}

.body-textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-height: 72px;
  padding: 8px 10px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $bg;
  color: $text;
  font-size: 13px;
  line-height: 1.55;
  font-family: inherit;
  resize: vertical;
  overflow-y: hidden;

  &::placeholder {
    color: $text-muted;
  }

  &:hover {
    border-color: #d1d5db;
  }

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 2px $primary-light;
    background: $surface;
  }

  &.is-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    background: #1f2937;
    color: #e5e7eb;
    border-color: #374151;

    &::placeholder {
      color: #9ca3af;
    }

    &:focus {
      border-color: $primary;
      box-shadow: 0 0 0 2px $primary-light;
    }
  }
}

.formatted-body {
  position: relative;
}

.formatted-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-bottom: 4px;

  button {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: $text-muted;
    border: 1px solid $border;
    background: $surface;

    &:hover {
      color: $primary;
      border-color: $primary;
    }
  }
}
</style>
