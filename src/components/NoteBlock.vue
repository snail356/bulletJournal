<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Attachment, ContentFormat, Note } from '@/types'
import AttachmentList from './AttachmentList.vue'
import ColorDotPicker from './ColorDotPicker.vue'
import CodeSnippet from './CodeSnippet.vue'
import MarkdownContent from './MarkdownContent.vue'
import AppIcon from './AppIcon.vue'
import InlineEditable from './InlineEditable.vue'
import { useTaskStore } from '@/stores/taskStore'
import { resolveContentType } from '@/utils/detectContentType'
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
const editingFormatted = ref(false)

const isCode = computed(() => props.note.contentType === 'code')
const isMarkdown = computed(() => props.note.contentType === 'markdown')
const isFormatted = computed(() => isCode.value || isMarkdown.value)

function shouldStartCollapsed(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  return trimmed.includes('\n') || trimmed.length > 80
}

const collapsed = ref(shouldStartCollapsed(props.note.content))

watch(
  () => props.note.id,
  () => {
    collapsed.value = shouldStartCollapsed(props.note.content)
  },
)

const oneLinePreview = computed(() => {
  const text = props.note.content.trim().replace(/\s+/g, ' ')
  if (!text) return '（空白備註）'
  return text.length > 72 ? `${text.slice(0, 72)}…` : text
})

function saveContent(content: string) {
  store.updateNote(props.taskId, props.note.id, {
    content,
    contentType: resolveContentType(content),
  })
  editingFormatted.value = false
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
  editingFormatted.value = false
}

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}

async function startEditing() {
  collapsed.value = false
  if (isFormatted.value) {
    editingFormatted.value = true
    await nextTick()
  }
  contentRef.value?.startEditing()
}

function applyPastedContent(text: string) {
  const contentType = resolveContentType(text)
  if (contentType === 'text') return

  store.updateNote(props.taskId, props.note.id, {
    content: text.replace(/\n$/, ''),
    contentType,
  })
  editingFormatted.value = false
  collapsed.value = shouldStartCollapsed(text)
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
      return
    }
  }

  const text = e.clipboardData?.getData('text/plain') ?? ''
  if (!text.trim()) return

  const contentType = resolveContentType(text)
  if (contentType === 'text') return

  e.preventDefault()
  e.stopPropagation()
  applyPastedContent(text)
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

function formatTag(type: ContentFormat): string | null {
  if (type === 'code') return 'code'
  if (type === 'markdown') return 'md'
  return null
}
</script>

<template>
  <div
    class="note"
    :class="{
      'is-formatted': isFormatted && !editingFormatted && !collapsed,
      collapsed,
    }"
    :style="{
      background: NOTE_COLOR_BG[note.color],
      borderColor: NOTE_COLOR_DOT[note.color],
    }"
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
        <button type="button" title="刪除" @click="remove">
          <AppIcon name="trash" size="xs" />
        </button>
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
      <CodeSnippet v-if="isCode && !editingFormatted" :code="note.content" />
      <MarkdownContent
        v-else-if="isMarkdown && !editingFormatted"
        :content="note.content"
      />
      <InlineEditable
        v-else
        ref="contentRef"
        :model-value="note.content"
        tag="p"
        class="content"
        :class="{ 'content-code': isCode }"
        multiline
        @save="saveContent"
        @editing-change="(v) => { if (!v) editingFormatted = false }"
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
  padding-right: 160px;
  border-radius: $radius-sm;
  border-left: 3px solid;
  margin-top: 8px;

  &:hover .actions,
  .actions:focus-within {
    opacity: 1;
    pointer-events: auto;
  }

  &.collapsed {
    padding-top: 8px;
    padding-bottom: 8px;
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

.content {
  font-size: 13px;
  white-space: pre-wrap;
  line-height: 1.6;

  &.content-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
  }
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
  right: -152px;
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

    &.collapsed {
      padding-top: 44px;
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
