<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { ContentFormat } from '@/types'
import CodeSnippet from './CodeSnippet.vue'
import MarkdownContent from './MarkdownContent.vue'
import AppIcon from './AppIcon.vue'
import { resolveContentType } from '@/utils/detectContentType'

const props = withDefaults(
  defineProps<{
    content: string
    contentType: ContentFormat
    placeholder?: string
    showFormattedActions?: boolean
    compact?: boolean
    autofocus?: boolean
    previewUntilEdit?: boolean
    borderless?: boolean
  }>(),
  {
    placeholder: '',
    showFormattedActions: true,
    compact: false,
    autofocus: false,
    previewUntilEdit: false,
    borderless: false,
  },
)

const emit = defineEmits<{
  commit: [content: string, contentType: ContentFormat]
  'convert-to-text': []
  'paste-image': [file: File]
  'editing-change': [editing: boolean]
}>()

const editingFormatted = ref(false)
const editingText = ref(false)
const draft = ref(props.content)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const isCode = computed(() => props.contentType === 'code')
const isMarkdown = computed(() => props.contentType === 'markdown')
const isFormatted = computed(() => isCode.value || isMarkdown.value)
const showEditor = computed(() => {
  if (isFormatted.value) return editingFormatted.value
  if (props.previewUntilEdit) return editingText.value
  return true
})
const showTextPreview = computed(
  () => props.previewUntilEdit && !isFormatted.value && !editingText.value,
)
const showEditingHint = computed(
  () => editingFormatted.value || (props.previewUntilEdit && editingText.value),
)

watch(
  () => props.content,
  (value) => {
    if (!showEditor.value || document.activeElement !== textareaRef.value) {
      draft.value = value
    }
  },
)

watch(
  [showEditor, draft],
  async () => {
    if (!showEditor.value) return
    await nextTick()
    if (textareaRef.value) autoResize(textareaRef.value)
  },
  { flush: 'post' },
)

watch(
  () => props.autofocus,
  (value) => {
    if (value) nextTick(() => startEditing())
  },
  { immediate: true },
)

onMounted(() => {
  if (showEditor.value && textareaRef.value) {
    autoResize(textareaRef.value)
  }
})

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function onInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  draft.value = el.value
  autoResize(el)
}

function normalize(text: string) {
  return text.replace(/\n$/, '')
}

function commitDraft() {
  const next = normalize(draft.value)
  const contentType = resolveContentType(next)
  editingFormatted.value = false
  editingText.value = false
  draft.value = next
  emit('editing-change', false)
  if (next === props.content && contentType === props.contentType) return
  emit('commit', next, contentType)
}

function convertToText() {
  emit('convert-to-text')
  editingFormatted.value = false
  draft.value = props.content
}

function placeCaretAtEnd(el: HTMLTextAreaElement) {
  const pos = el.value.length
  el.setSelectionRange(pos, pos)
}

async function startEditing() {
  if (isFormatted.value) {
    editingFormatted.value = true
    draft.value = props.content
  } else {
    editingText.value = true
    draft.value = props.content
  }
  emit('editing-change', true)
  await nextTick()
  const el = textareaRef.value
  if (!el) return
  el.focus({ preventScroll: true })
  placeCaretAtEnd(el)
  autoResize(el)
  requestAnimationFrame(() => placeCaretAtEnd(el))
}

function applyPastedContent(text: string) {
  const next = normalize(text)
  const contentType = resolveContentType(next)
  if (contentType === 'text') return false

  draft.value = next
  editingFormatted.value = false
  editingText.value = false
  emit('editing-change', false)
  emit('commit', next, contentType)
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
        if (file) emit('paste-image', file)
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

  e.stopPropagation()
  nextTick(() => {
    const el = textareaRef.value
    if (!el) return
    draft.value = el.value
    autoResize(el)
    applyPastedContent(el.value)
  })
}

function onDoubleClick(e: MouseEvent) {
  if (showEditor.value || !isFormatted.value) return
  e.preventDefault()
  e.stopPropagation()
  startEditing()
}

defineExpose({ startEditing })
</script>

<template>
  <div
    class="formatted-content-editor"
    :class="{
      compact,
      borderless,
      'is-formatted': isFormatted && !editingFormatted,
      'is-editing': showEditingHint,
    }"
    @paste="onPaste"
    @contextmenu.stop
    @dblclick="onDoubleClick"
    :title="showEditingHint ? '編輯中' : undefined"
  >
    <div v-if="isCode && !editingFormatted" class="formatted-body">
      <div v-if="showFormattedActions" class="formatted-actions">
        <button type="button" title="編輯" @click="startEditing">
          <AppIcon name="pen" size="xs" />
        </button>
        <button type="button" title="轉為一般文字" @click="convertToText">
          <AppIcon name="file-lines" size="xs" />
        </button>
      </div>
      <CodeSnippet :code="content" />
    </div>
    <div v-else-if="isMarkdown && !editingFormatted" class="formatted-body">
      <div v-if="showFormattedActions" class="formatted-actions">
        <button type="button" title="編輯" @click="startEditing">
          <AppIcon name="pen" size="xs" />
        </button>
        <button type="button" title="轉為一般文字" @click="convertToText">
          <AppIcon name="file-lines" size="xs" />
        </button>
      </div>
      <MarkdownContent :content="content" />
    </div>
    <p
      v-else-if="showTextPreview"
      class="text-preview"
      :class="{ 'is-placeholder': !content }"
      @click="startEditing"
    >
      {{ content || placeholder }}
    </p>
    <textarea
      v-else
      ref="textareaRef"
      class="content-textarea"
      :class="{ 'is-code': isCode }"
      :value="draft"
      rows="1"
      :placeholder="placeholder"
      @input="onInput"
      @blur="commitDraft"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.formatted-content-editor {
  position: relative;
  min-width: 0;
  overflow: visible;

  &:hover,
  &:focus-within {
    .formatted-actions {
      opacity: 1;
      pointer-events: auto;
    }
  }
}

.text-preview {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  cursor: text;

  &.is-placeholder {
    color: $text-muted;
  }
}

.content-textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-height: 0;
  padding: 8px 10px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $bg;
  color: $text;
  font-size: 13px;
  line-height: 1.55;
  font-family: inherit;
  resize: none;
  overflow: hidden;
  field-sizing: content;

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
  min-width: 0;
}

.formatted-actions {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  display: flex;
  gap: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;

  button {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: $text-muted;
    border: 1px solid $border;
    background: rgba($surface, 0.95);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);

    &:hover {
      color: $primary;
      border-color: $primary;
    }
  }
}

.compact {
  .text-preview {
    font-size: 12px;
    line-height: 1.5;
  }

  .content-textarea {
    padding: 6px 8px;
    font-size: 12px;
    line-height: 1.5;
    background: transparent;
    border-color: transparent;

    &:hover {
      border-color: #d1d5db;
    }

    &:focus {
      background: $surface;
    }

    &.is-code {
      background: #1f2937;
      color: #e5e7eb;
      border-color: #374151;

      &:hover,
      &:focus {
        background: #1f2937;
        border-color: #374151;
      }
    }
  }

  .formatted-actions button {
    width: 24px;
    height: 24px;
  }
}

.borderless .content-textarea {
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;

  &:hover,
  &:focus {
    border: none;
    box-shadow: none;
    background: transparent;
  }

  &.is-code {
    padding: 8px 10px;
    border-radius: $radius-sm;
    background: #1f2937;
    color: #e5e7eb;
    border: 1px solid #374151;

    &:hover,
    &:focus {
      background: #1f2937;
      color: #e5e7eb;
      border-color: #374151;
      box-shadow: none;
    }
  }
}
</style>
