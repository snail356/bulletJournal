<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Task } from '@/types'
import CodeSnippet from './CodeSnippet.vue'
import AppIcon from './AppIcon.vue'
import { useTaskStore } from '@/stores/taskStore'
import { looksLikeCode } from '@/utils/detectCode'

const props = defineProps<{
  taskId: string
  content: string
  contentType: Task['bodyContentType']
}>()

const store = useTaskStore()
const expanded = ref(true)
const editingCode = ref(false)
const draft = ref(props.content)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const isCode = computed(() => props.contentType === 'code')
const hasContent = computed(() => props.content.trim().length > 0)
const showEditor = computed(() => !isCode.value || editingCode.value)

const preview = computed(() => {
  const text = props.content.trim().replace(/\s+/g, ' ')
  if (!text) return '尚無內容'
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

function resolveContentType(content: string): Task['bodyContentType'] {
  return looksLikeCode(content) ? 'code' : 'text'
}

function commitDraft() {
  const next = draft.value.replace(/\n$/, '')
  const contentType = resolveContentType(next)
  store.updateTask(props.taskId, {
    bodyContent: next,
    bodyContentType: contentType,
  })
  editingCode.value = false
  draft.value = next
}

function convertToText() {
  store.updateTask(props.taskId, { bodyContentType: 'text' })
  editingCode.value = false
  draft.value = props.content
}

async function startEditCode() {
  editingCode.value = true
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

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text/plain') ?? ''
  if (!text.trim() || !looksLikeCode(text)) return

  // 讓 paste 先進入 textarea，再於 nextTick 依內容判定 code
  nextTick(() => {
    const el = textareaRef.value
    if (!el) return
    draft.value = el.value
    autoResize(el)
    if (looksLikeCode(el.value)) {
      store.updateTask(props.taskId, {
        bodyContent: el.value.replace(/\n$/, ''),
        bodyContentType: 'code',
      })
      editingCode.value = false
    }
  })
}

/** 阻止冒泡至主任務右鍵選單，保留瀏覽器原生複製／貼上選單 */
function onContextMenu(e: MouseEvent) {
  e.stopPropagation()
}
</script>

<template>
  <div class="section body-section" @contextmenu="onContextMenu">
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
        <p class="section-title">內容</p>
      </button>
    </div>

    <p
      v-if="!expanded"
      class="collapsed-preview"
      @click="expanded = true"
    >
      <span v-if="isCode && hasContent" class="code-tag">code</span>
      {{ preview }}
    </p>

    <div v-else class="body-area">
      <div v-if="isCode && !editingCode" class="code-body">
        <div class="code-actions">
          <button type="button" title="編輯" @click="startEditCode">
            <AppIcon name="pen" size="xs" />
          </button>
          <button type="button" title="轉為一般文字" @click="convertToText">
            <AppIcon name="file-lines" size="xs" />
          </button>
        </div>
        <CodeSnippet :code="content" />
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
    </div>
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

.code-tag {
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

.code-body {
  position: relative;
}

.code-actions {
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
