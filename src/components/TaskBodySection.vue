<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Attachment, ContentFormat, Task } from '@/types'
import AttachmentList from './AttachmentList.vue'
import AppIcon from './AppIcon.vue'
import FormattedContentEditor from './FormattedContentEditor.vue'
import { useTaskStore } from '@/stores/taskStore'
import { resolveContentType } from '@/utils/detectContentType'
import { getBodyExpanded, setBodyExpanded } from '@/utils/sectionCollapseState'

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
const fileInput = ref<HTMLInputElement | null>(null)

function defaultBodyExpanded(): boolean {
  return props.content.trim().length > 0 || props.attachments.length > 0
}

const expanded = ref(getBodyExpanded(props.taskId, defaultBodyExpanded()))

watch(expanded, (value) => {
  setBodyExpanded(props.taskId, value)
})

watch(
  () => props.taskId,
  (taskId) => {
    expanded.value = getBodyExpanded(taskId, defaultBodyExpanded())
  },
)

const hasContent = computed(() => props.content.trim().length > 0)
const hasCollapsedPreview = computed(
  () => hasContent.value || props.attachments.length > 0,
)

const preview = computed(() => {
  const text = props.content.trim().replace(/\s+/g, ' ')
  if (!text) {
    if (props.attachments.length) return `${props.attachments.length} 張圖片`
    return '尚無內容'
  }
  return text.length > 48 ? `${text.slice(0, 48)}…` : text
})

function commitContent(content: string, contentType: ContentFormat) {
  store.updateTask(props.taskId, {
    bodyContent: content,
    bodyContentType: contentType,
  })
}

function convertToText() {
  store.updateTask(props.taskId, { bodyContentType: 'text' })
}

function toggleExpanded() {
  expanded.value = !expanded.value
}

async function onPasteImage(file: File) {
  expanded.value = true
  await store.addAttachment('task', props.taskId, file)
}

async function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (items) {
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        e.stopPropagation()
        const file = item.getAsFile()
        if (file) await onPasteImage(file)
        return
      }
    }
  }

  if (expanded.value) return

  const text = e.clipboardData?.getData('text/plain') ?? ''
  if (!text.trim()) return

  const contentType = resolveContentType(text)
  if (contentType === 'text') return

  e.preventDefault()
  e.stopPropagation()
  commitContent(text.replace(/\n$/, ''), contentType)
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
      v-if="!expanded && hasCollapsedPreview"
      class="collapsed-preview"
      @click="expanded = true"
    >
      <span v-if="formatTag(contentType) && hasContent" class="format-tag">
        {{ formatTag(contentType) }}
      </span>
      {{ preview }}
    </p>

    <div v-else-if="expanded" class="body-area">
      <FormattedContentEditor
        :content="content"
        :content-type="contentType"
        placeholder="尚無內容"
        @commit="commitContent"
        @convert-to-text="convertToText"
        @paste-image="onPasteImage"
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

  &:hover,
  &:focus-within {
    .upload-btn {
      opacity: 1;
      pointer-events: auto;
    }
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  min-height: 28px;
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
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;

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
</style>
