<script setup lang="ts">
import { computed, inject, nextTick, onMounted, ref, watch } from "vue";
import type { Attachment, SubTask } from "@/types";
import AttachmentList from "./AttachmentList.vue";
import AppIcon from "./AppIcon.vue";
import InlineEditable from "./InlineEditable.vue";
import { SUBTASK_DRAG_KEY } from "@/composables/taskDrag";
import { useTaskStore } from "@/stores/taskStore";

const props = defineProps<{
  subtask: SubTask;
  taskId: string;
  autofocus?: boolean;
}>();

const emit = defineEmits<{
  preview: [attachment: Attachment];
}>();

const store = useTaskStore();
const subtaskDrag = inject(SUBTASK_DRAG_KEY, null);
const isDragging = computed(
  () => subtaskDrag?.draggingId.value === props.subtask.id,
);
const isDragOver = computed(
  () => subtaskDrag?.dragOverId.value === props.subtask.id,
);
const hasNote = computed(() => props.subtask.note.trim().length > 0);
const editing = ref(false);
const noteEditing = ref(false);
const hovered = ref(false);
const noteExpanded = ref(hasNote.value);
const fileInput = ref<HTMLInputElement | null>(null);
const titleRef = ref<InstanceType<typeof InlineEditable> | null>(null);
const noteRef = ref<InstanceType<typeof InlineEditable> | null>(null);
const subtaskEl = ref<HTMLElement | null>(null);

watch(
  () => props.autofocus,
  (v) => {
    if (v) nextTick(() => titleRef.value?.startEditing());
  },
  { immediate: true },
);

onMounted(() => {
  if (props.autofocus) subtaskEl.value?.focus();
});

watch(
  () => props.subtask.note,
  (note) => {
    if (note.trim()) noteExpanded.value = true;
  },
);

function saveTitle(title: string) {
  if (!title.trim()) {
    remove();
    return;
  }
  store.updateSubTask(props.taskId, props.subtask.id, { title });
}

function saveNote(note: string) {
  store.updateSubTask(props.taskId, props.subtask.id, { note });
}

function toggleNote() {
  noteExpanded.value = !noteExpanded.value;
  if (noteExpanded.value && !hasNote.value) {
    noteRef.value?.startEditing();
  }
}

function toggle() {
  store.toggleSubTask(props.taskId, props.subtask.id);
}

function remove() {
  store.deleteSubTask(props.taskId, props.subtask.id);
}

async function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      e.preventDefault();
      e.stopPropagation();
      const file = item.getAsFile();
      if (file) await store.addAttachment("subtask", props.subtask.id, file);
      return;
    }
  }
}

function focusSubtask() {
  subtaskEl.value?.focus();
}

function onSubtaskMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  if (
    target?.closest(
      ".inline-editable, [contenteditable], input, button, label, .drag-handle, a",
    )
  ) {
    return;
  }
  focusSubtask();
}

function triggerUpload() {
  fileInput.value?.click();
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) await store.addAttachment("subtask", props.subtask.id, file);
  input.value = "";
}
</script>

<template>
  <div
    ref="subtaskEl"
    class="subtask"
    tabindex="-1"
    :class="{
      completed: subtask.completed,
      dragging: isDragging,
      'drag-over': isDragOver,
    }"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @mousedown="onSubtaskMouseDown"
    @paste.capture="onPaste"
    @contextmenu.prevent
    @dragover="subtaskDrag?.onDragOver($event, subtask.id)"
    @drop="subtaskDrag?.onDrop($event, subtask.id)"
  >
    <span
      v-if="subtaskDrag"
      class="drag-handle"
      draggable="true"
      aria-label="拖曳排序"
      @dragstart="subtaskDrag.onDragStart($event, subtask.id)"
      @dragend="subtaskDrag.onDragEnd"
    >
      <AppIcon name="grip-vertical" />
    </span>

    <label class="check-wrap">
      <input type="checkbox" :checked="subtask.completed" @change="toggle" />
      <span class="check" :class="{ checked: subtask.completed }">
        <AppIcon
          v-if="subtask.completed"
          name="check"
          size="xs"
          class="check-icon"
        />
      </span>
    </label>

    <div class="body">
      <InlineEditable
        ref="titleRef"
        :model-value="subtask.title"
        class="title"
        save-when-empty
        @save="saveTitle"
        @editing-change="editing = $event"
      />

      <div v-if="noteExpanded" class="note-area">
        <InlineEditable
          ref="noteRef"
          :model-value="subtask.note"
          tag="p"
          class="note"
          multiline
          hint
          save-when-empty
          placeholder="新增備註…"
          @save="saveNote"
          @editing-change="noteEditing = $event"
        />
      </div>

      <AttachmentList
        :attachments="subtask.attachments"
        @preview="emit('preview', $event)"
      />
    </div>

    <div
      class="actions"
      :class="{ visible: hovered && !editing && !noteEditing }"
    >
      <button
        type="button"
        class="note-toggle"
        :title="noteExpanded ? '收合備註' : '展開備註'"
        @click="toggleNote"
      >
        <AppIcon
          :name="noteExpanded ? 'chevron-down' : 'chevron-right'"
          size="xs"
        />
        <span v-if="hasNote && !noteExpanded" class="note-dot" />
      </button>
      <button type="button" title="貼上圖片" @click="triggerUpload">
        <AppIcon name="image" size="xs" />
      </button>
      <button type="button" title="刪除" @click="remove">
        <AppIcon name="trash" size="xs" />
      </button>
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
@use "@/styles/variables" as *;

.subtask {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 100px 8px 4px;
  border-radius: $radius-sm;
  transition:
    background 0.15s,
    transform 0.15s,
    box-shadow 0.15s;
  outline: none;

  &:hover {
    background: $bg;
  }

  &.completed :deep(.title) {
    color: $text-muted;
    text-decoration: line-through;
    opacity: 0.65;
  }

  &.dragging {
    opacity: 0.45;
  }

  &.drag-over {
    transform: translateY(2px);
    box-shadow: inset 0 -2px 0 $primary;
  }
}

.drag-handle {
  padding-top: 2px;
  color: $text-muted;
  font-size: 14px;
  cursor: grab;
  opacity: 0.4;
  line-height: 1;
  user-select: none;
  flex-shrink: 0;

  &:hover {
    opacity: 0.8;
  }

  &:active {
    cursor: grabbing;
  }
}

.check-wrap {
  display: flex;
  align-items: center;
  padding-top: 2px;
  cursor: pointer;
  flex-shrink: 0;

  input {
    display: none;
  }
}

.check {
  width: 16px;
  height: 16px;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &.checked {
    background: $primary;
    border-color: $primary;
  }
}

.check-icon {
  color: white;
}

.body {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 13px;
  display: block;
  padding: 2px 0;
  max-width: 100%;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.note-area {
  margin-top: 4px;
  padding: 6px 8px;
  border-left: 2px solid $border;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 0 $radius-sm $radius-sm 0;
}

.note {
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  color: $text-muted;
}

.actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
  opacity: 0;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 6px;
  padding: 2px;
  transition: opacity 0.15s;

  &.visible {
    opacity: 1;
    pointer-events: auto;
  }

  button {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: $surface;
    }
  }
}

.note-toggle {
  position: relative;
}

.note-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: $primary;
}

@media (max-width: $breakpoint-sm) {
  .subtask {
    flex-wrap: wrap;
    padding: 8px 4px 40px;
  }

  .actions {
    top: auto;
    bottom: 4px;
    right: 4px;
    left: 4px;
    justify-content: flex-end;
    opacity: 1;
    pointer-events: auto;
    background: transparent;
  }
}
</style>
