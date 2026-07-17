<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Attachment, Note } from '@/types'
import AttachmentList from './AttachmentList.vue'
import ColorDotPicker from './ColorDotPicker.vue'
import CodeSnippet from './CodeSnippet.vue'
import AppIcon from './AppIcon.vue'
import InlineEditable from './InlineEditable.vue'
import { useTaskStore } from '@/stores/taskStore'
import { looksLikeCode } from '@/utils/detectCode'
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
const editingCode = ref(false)

const isCode = computed(() => props.note.contentType === 'code')

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

function resolveContentType(content: string): Note['contentType'] {
  return looksLikeCode(content) ? 'code' : 'text'
}

function saveContent(content: string) {
  store.updateNote(props.taskId, props.note.id, {
    content,
    contentType: resolveContentType(content),
  })
  editingCode.value = false
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
  editingCode.value = false
}

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}

async function startEditing() {
  collapsed.value = false
  if (isCode.value) {
    editingCode.value = true
    await nextTick()
  }
  contentRef.value?.startEditing()
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
  if (!text.trim() || !looksLikeCode(text)) return

  e.preventDefault()
  e.stopPropagation()
  store.updateNote(props.taskId, props.note.id, {
    content: text.replace(/\n$/, ''),
    contentType: 'code',
  })
  editingCode.value = false
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
</script>

<template>
  <div
    class="note"
    :class="{
      'is-code': isCode && !editingCode && !collapsed,
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
          v-if="isCode"
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
      <span v-if="isCode" class="code-tag">code</span>
      <span class="preview-text">{{ oneLinePreview }}</span>
    </button>
    <template v-else>
      <CodeSnippet v-if="isCode && !editingCode" :code="note.content" />
      <InlineEditable
        v-else
        ref="contentRef"
        :model-value="note.content"
        tag="p"
        class="content"
        :class="{ 'content-code': isCode }"
        multiline
        @save="saveContent"
        @editing-change="(v) => { if (!v) editingCode = false }"
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

.code-tag {
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
