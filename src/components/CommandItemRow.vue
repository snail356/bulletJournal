<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import type { CommandItem } from '@/types'
import AppIcon from '@/components/AppIcon.vue'
import DeleteIconButton from '@/components/DeleteIconButton.vue'
import DragHandle from '@/components/DragHandle.vue'
import PopoverIconButton from '@/components/PopoverIconButton.vue'
import { useCommandStore } from '@/stores/commandStore'

const props = defineProps<{
  categoryId: string
  item: CommandItem
  autofocus?: boolean
  dragging?: boolean
  dragOver?: boolean
}>()

const emit = defineEmits<{
  dragStart: [event: DragEvent]
  dragOver: [event: DragEvent]
  drop: [event: DragEvent]
  dragEnd: []
}>()

const store = useCommandStore()
const editing = ref(!props.item.content.trim())
const draftContent = ref(props.item.content)
const draftNote = ref(props.item.note)
const contentRef = ref<HTMLTextAreaElement | null>(null)
const noteRef = ref<HTMLTextAreaElement | null>(null)
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.autofocus,
  async (value) => {
    if (!value) return
    editing.value = true
    await nextTick()
    focusContent()
  },
  { immediate: true },
)

watch(editing, async (value) => {
  if (!value) return
  await nextTick()
  focusContent()
})

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.max(el.scrollHeight, 40)}px`
}

function resizeEditors() {
  autoResize(contentRef.value)
  autoResize(noteRef.value)
}

function focusContent() {
  const el = contentRef.value
  if (!el) return
  el.focus()
  resizeEditors()
  const end = el.value.length
  el.setSelectionRange(end, end)
}

function onEditorInput(event: Event) {
  autoResize(event.target as HTMLTextAreaElement)
}

onUnmounted(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})

async function copyContent() {
  const text = props.item.content.replace(/\s+$/, '')
  if (!text.trim()) return
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    // 瀏覽器不允許剪貼簿時略過
  }
}

function startEdit() {
  draftContent.value = props.item.content
  draftNote.value = props.item.note
  editing.value = true
}

function commit() {
  if (!editing.value) return
  const content = draftContent.value.replace(/\r\n/g, '\n').replace(/\s+$/, '')
  const note = draftNote.value.replace(/\r\n/g, '\n').replace(/\s+$/, '')
  if (!content.trim()) {
    store.deleteItem(props.categoryId, props.item.id)
    return
  }
  store.updateItem(props.categoryId, props.item.id, { content, note })
  editing.value = false
}

function cancel() {
  if (!props.item.content.trim()) {
    store.deleteItem(props.categoryId, props.item.id)
    return
  }
  draftContent.value = props.item.content
  draftNote.value = props.item.note
  editing.value = false
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  const root = event.currentTarget as HTMLElement | null
  if (next && root?.contains(next)) return
  commit()
}
</script>

<template>
  <li
    class="command-item"
    :class="{ editing, dragging, 'drag-over': dragOver }"
    @dragover="emit('dragOver', $event)"
    @drop="emit('drop', $event)"
  >
    <DragHandle
      v-if="!editing"
      size="xs"
      class="item-drag"
      @drag-start="emit('dragStart', $event)"
      @drag-end="emit('dragEnd')"
    />
    <form
      v-if="editing"
      class="edit-form"
      @submit.prevent="commit"
      @focusout="onFocusOut"
    >
      <textarea
        ref="contentRef"
        v-model="draftContent"
        class="edit-input command-input"
        rows="2"
        placeholder="指令或可複製內容"
        @input="onEditorInput"
        @keydown.escape.prevent="cancel"
      />
      <textarea
        ref="noteRef"
        v-model="draftNote"
        class="edit-input"
        rows="2"
        placeholder="說明（選填）"
        @input="onEditorInput"
        @keydown.escape.prevent="cancel"
      />
    </form>

    <div v-else class="item-body">
      <div class="command-row">
        <button
          type="button"
          class="command-text"
          :title="copied ? '已複製' : '點選複製到剪貼簿'"
          @click="copyContent"
        >
          {{ item.content }}
        </button>
        <button
          type="button"
          class="copy-btn"
          :class="{ copied }"
          :title="copied ? '已複製' : '複製'"
          :aria-label="copied ? '已複製' : '複製到剪貼簿'"
          @click="copyContent"
        >
          <AppIcon :name="copied ? 'check' : 'copy'" size="xs" />
        </button>
      </div>
      <p v-if="item.note" class="note">{{ item.note }}</p>
      <div class="item-actions">
        <PopoverIconButton icon="pen" label="編輯" @click="startEdit" />
        <DeleteIconButton
          title="刪除指令"
          :message="`確定刪除「${item.content}」？`"
          label="刪除指令"
          @confirm="store.deleteItem(categoryId, item.id)"
        />
      </div>
    </div>
  </li>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.command-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 10px 12px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $bg;
  transition: opacity 0.15s, box-shadow 0.15s;

  &.editing {
    grid-template-columns: minmax(0, 1fr);
  }

  &.dragging {
    opacity: 0.45;
  }

  &.drag-over {
    box-shadow: inset 0 -2px 0 $primary;
  }
}

.item-drag {
  padding-top: 6px;
}

.item-body {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 8px;
  align-items: start;
}

.command-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.command-text {
  flex: 1;
  min-width: 0;
  text-align: left;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  color: $text;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  border-radius: 4px;
  padding: 2px 4px;
  margin: -2px -4px;

  &:hover {
    background: $primary-light;
    color: $primary-dark;
  }
}

.copy-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: $text-muted;

  &:hover {
    color: $primary;
    background: $primary-light;
  }

  &.copied {
    color: #059669;
  }
}

.note {
  grid-column: 1;
  font-size: 12px;
  line-height: 1.5;
  color: $text-muted;
  padding-left: 4px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.item-actions {
  grid-column: 2;
  grid-row: 1 / span 2;
  display: flex;
  align-items: center;
  gap: 2px;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $surface;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  overflow: hidden;
  white-space: pre-wrap;

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 2px $primary-light;
  }
}

.command-input {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
