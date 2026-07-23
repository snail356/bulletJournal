<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ToolboxItem } from '@/types'
import AppIcon from './AppIcon.vue'
import CodeSnippet from './CodeSnippet.vue'
import MarkdownContent from './MarkdownContent.vue'
import { useTaskStore } from '@/stores/taskStore'
import { resolveContentType } from '@/utils/detectContentType'
import { getClipboardMarkdown } from '@/utils/htmlToMarkdown'

const props = defineProps<{
  listId: string
  item: ToolboxItem
  index: number
  autofocus?: boolean
}>()

const store = useTaskStore()
const editing = ref(!props.item.content.trim())
const draft = ref(props.item.content)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const isCode = computed(() => props.item.contentType === 'code')
const isMarkdown = computed(() => props.item.contentType === 'markdown')
const isFormatted = computed(() => isCode.value || isMarkdown.value)

watch(
  () => props.item.content,
  (value) => {
    if (!editing.value || document.activeElement !== textareaRef.value) {
      draft.value = value
    }
  },
)

watch(
  () => props.autofocus,
  async (v) => {
    if (!v) return
    editing.value = true
    await nextTick()
    focusEditor()
  },
  { immediate: true },
)

watch(editing, async (v) => {
  if (!v) return
  await nextTick()
  focusEditor()
})

function focusEditor() {
  const el = textareaRef.value
  if (!el) return
  el.focus()
  autoResize(el)
  el.setSelectionRange(el.value.length, el.value.length)
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.max(el.scrollHeight, 40)}px`
}

function onInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  draft.value = el.value
  autoResize(el)
}

function commit() {
  const next = draft.value.replace(/\n$/, '')
  if (!next.trim()) {
    store.deleteToolboxItem(props.listId, props.item.id)
    return
  }
  store.updateToolboxItem(props.listId, props.item.id, {
    content: next,
    contentType: resolveContentType(next),
  })
  draft.value = next
  editing.value = false
}

function startEdit() {
  draft.value = props.item.content
  editing.value = true
}

function convertToText() {
  store.updateToolboxItem(props.listId, props.item.id, {
    contentType: 'text',
  })
  editing.value = true
}

function remove() {
  store.deleteToolboxItem(props.listId, props.item.id)
}

function onPaste(e: ClipboardEvent) {
  const text = getClipboardMarkdown(e)
  if (!text.trim()) return

  e.preventDefault()
  const el = textareaRef.value
  if (!el) {
    draft.value = text
    return
  }

  const start = el.selectionStart
  const end = el.selectionEnd
  const before = draft.value.slice(0, start)
  const after = draft.value.slice(end)
  draft.value = `${before}${text}${after}`
  nextTick(() => {
    autoResize(el)
    const cursor = start + text.length
    el.setSelectionRange(cursor, cursor)
  })
}

</script>

<template>
  <li class="item" :class="{ editing }">
    <span class="item-index">{{ index + 1 }}</span>

    <div class="item-body">
      <div v-if="!editing && isFormatted" class="formatted">
        <CodeSnippet v-if="isCode" :code="item.content" />
        <MarkdownContent v-else :content="item.content" />
      </div>

      <button
        v-else-if="!editing"
        type="button"
        class="plain-preview"
        @click="startEdit"
      >
        {{ item.content || '寫下一個可對照的問題或原則…' }}
      </button>

      <textarea
        v-else
        ref="textareaRef"
        class="item-textarea"
        :class="{ 'is-code': isCode }"
        :value="draft"
        rows="2"
        placeholder="寫下一個可對照的問題或原則…（可貼上粗體、程式碼）"
        @input="onInput"
        @blur="commit"
        @paste="onPaste"
      />
    </div>

    <div class="item-tools">
      <template v-if="!editing && isFormatted">
        <button type="button" title="編輯" @click="startEdit">
          <AppIcon name="pen" size="xs" />
        </button>
        <button type="button" title="轉為一般文字" @click="convertToText">
          <AppIcon name="file-lines" size="xs" />
        </button>
      </template>
      <button
        type="button"
        class="item-delete"
        title="刪除項目"
        @click="remove"
      >
        <AppIcon name="trash" size="xs" />
      </button>
    </div>
  </li>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.item {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
  padding: 8px;
  border-radius: $radius-sm;
  background: $bg;
  border-left: 3px solid $border;

  &:hover,
  &:focus-within,
  &.editing {
    border-left-color: $primary;

    .item-tools {
      opacity: 1;
      pointer-events: auto;
    }
  }
}

.item-index {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: $primary;
  background: $primary-light;
  border-radius: 6px;
  flex-shrink: 0;
  // 對齊第一行文字（13px × 1.55）
  margin-top: 0;
  line-height: 1;
}

.item-body {
  min-width: 0;
  padding-top: 4px;
}

.plain-preview {
  display: block;
  width: 100%;
  text-align: left;
  font-size: 13px;
  line-height: 1.55;
  color: $text;
  padding: 0;
  white-space: pre-wrap;
  word-break: break-word;

  &:hover {
    color: $primary;
  }
}

.item-textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-height: 40px;
  padding: 6px 8px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $surface;
  color: $text;
  font-size: 13px;
  line-height: 1.55;
  font-family: inherit;
  resize: vertical;
  overflow-y: hidden;

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 2px $primary-light;
  }

  &.is-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
  }
}

.formatted {
  min-width: 0;
  font-size: 13px;
  line-height: 1.55;

  :deep(.markdown-content),
  :deep(.code-snippet) {
    margin: 0;
  }

  :deep(.markdown-body > *:first-child) {
    margin-top: 0;
  }
}

.item-tools {
  display: flex;
  align-items: center;
  gap: 2px;
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

    &:hover {
      color: $primary;
      background: rgba(255, 255, 255, 0.8);
    }
  }
}

.item-delete:hover {
  color: #ef4444 !important;
  background: rgba(#ef4444, 0.1) !important;
}
</style>
