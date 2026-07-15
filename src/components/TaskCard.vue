<script setup lang="ts">
import { computed, inject, nextTick, provide, ref, watch } from 'vue'
import type { Attachment, SubTask, Task, TaskStatus } from '@/types'
import { formatDisplayDate } from '@/utils/date'
import SubTaskItem from './SubTaskItem.vue'
import NoteBlock from './NoteBlock.vue'
import AttachmentList from './AttachmentList.vue'
import TaskContextMenu from './TaskContextMenu.vue'
import type { ContextMenuItem } from './TaskContextMenu.vue'
import TaskFormModal from './TaskFormModal.vue'
import TaskStatusDropdown from './TaskStatusDropdown.vue'
import TaskLabelsDropdown from './TaskLabelsDropdown.vue'
import SearchableCombobox from './SearchableCombobox.vue'
import QuickInputModal from './QuickInputModal.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import AppIcon from './AppIcon.vue'
import InlineEditable from './InlineEditable.vue'
import { SUBTASK_DRAG_KEY, TASK_DRAG_KEY } from '@/composables/taskDrag'
import { useReorderDrag } from '@/composables/useReorderDrag'
import { useTaskStore } from '@/stores/taskStore'

const props = defineProps<{
  task: Task
  migratedAway?: boolean
}>()

const emit = defineEmits<{
  preview: [attachment: Attachment]
  deleted: [task: Task]
}>()

const store = useTaskStore()
const taskDrag = inject(TASK_DRAG_KEY, null)

const isTaskDragging = computed(() => taskDrag?.draggingId.value === props.task.id)
const isTaskDragOver = computed(() => taskDrag?.dragOverId.value === props.task.id)

const subtaskDrag = useReorderDrag<SubTask>(
  () => props.task.subtasks,
  (fromId, toId) => store.reorderSubTasks(props.task.id, fromId, toId),
)
provide(SUBTASK_DRAG_KEY, subtaskDrag)

const menuVisible = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const showEditModal = ref(false)
const showNoteModal = ref(false)
const showMoveDate = ref(false)
const showCompleteConfirm = ref(false)
const showDeleteConfirm = ref(false)
const pendingFocusSubtaskId = ref<string | null>(null)
const moveDateValue = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const expanded = ref(store.expandAllTasks)

watch(
  () => store.expandAllTasks,
  (v) => {
    expanded.value = v
  },
)

function toggleExpanded() {
  expanded.value = !expanded.value
}

const subtaskProgress = computed(() => {
  const total = props.task.subtasks.length
  const done = props.task.subtasks.filter((s) => s.completed).length
  return { total, done }
})

const incompleteSubtaskCount = computed(
  () => props.task.subtasks.filter((s) => !s.completed).length,
)

const isMigrated = computed(() => props.migratedAway === true)

const migratedTargetLabel = computed(() => formatDisplayDate(props.task.date))

const difficultyOptions = computed(() => store.getDifficultyNoteOptions())

const hoursDraft = ref(formatHoursDraft(props.task.statusHours))

watch(
  () => props.task.statusHours,
  (hours) => {
    hoursDraft.value = formatHoursDraft(hours)
  },
)

function formatHoursDraft(hours: number | null): string {
  return hours != null ? String(hours) : ''
}

function commitHours() {
  const raw = String(hoursDraft.value ?? '').trim()
  if (raw === '') {
    store.setTaskStatusHours(props.task.id, null)
    hoursDraft.value = ''
    return
  }
  const hours = Number(raw)
  if (Number.isNaN(hours) || hours < 0) {
    hoursDraft.value = formatHoursDraft(props.task.statusHours)
    return
  }
  store.setTaskStatusHours(props.task.id, hours)
  hoursDraft.value = String(hours)
}

function onHoursKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitHours()
    ;(e.target as HTMLInputElement).blur()
  }
}

function onDifficultyNoteCommit(value: string) {
  store.setTaskDifficultyNote(props.task.id, value)
}

function goToCurrentDate() {
  if (!isMigrated.value) return
  store.setSelectedDate(props.task.date)
}

const menuItems: ContextMenuItem[] = [
  { key: 'edit', label: '編輯任務' },
  { key: 'add-subtask', label: '新增子任務' },
  { key: 'add-note', label: '新增備註' },
  { key: 'paste-image', label: '貼上圖片' },
  { key: 'duplicate', label: '複製任務' },
  { key: 'move', label: '移動到其他日期' },
  { key: 'delete', label: '刪除任務', danger: true, divider: true },
]

function openMenu(e: MouseEvent) {
  menuX.value = e.clientX
  menuY.value = e.clientY
  menuVisible.value = true
}

function onContextMenu(e: MouseEvent) {
  if (isMigrated.value) return
  e.preventDefault()
  openMenu(e)
}

function saveTitle(title: string) {
  if (isMigrated.value) return
  store.updateTask(props.task.id, { title })
}

function addSubtaskInline() {
  const sub = store.createSubTask(props.task.id, '')
  if (sub) {
    pendingFocusSubtaskId.value = sub.id
    nextTick(() => {
      pendingFocusSubtaskId.value = null
    })
  }
}

function saveEmptyNote(content: string) {
  store.createNote(props.task.id, content)
}

function onCompleteChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.checked) {
    if (incompleteSubtaskCount.value > 0) {
      showCompleteConfirm.value = true
      return
    }
    store.toggleTask(props.task.id)
  } else {
    store.toggleTask(props.task.id)
  }
}

function confirmCompleteWithSubtasks() {
  store.completeTaskWithSubtasks(props.task.id)
}

function confirmDelete() {
  emit('deleted', props.task)
  showDeleteConfirm.value = false
}

function requestDelete() {
  showDeleteConfirm.value = true
}

function onMenuSelect(key: string) {
  menuVisible.value = false
  switch (key) {
    case 'edit':
      showEditModal.value = true
      break
    case 'add-subtask':
      addSubtaskInline()
      break
    case 'add-note':
      showNoteModal.value = true
      break
    case 'paste-image':
      onContextPaste()
      break
    case 'duplicate':
      store.duplicateTask(props.task.id)
      break
    case 'move':
      moveDateValue.value = props.task.date
      showMoveDate.value = true
      break
    case 'delete':
      requestDelete()
      break
  }
}

function onStatusChange(status: TaskStatus) {
  store.updateTask(props.task.id, {
    status,
    completed: status === 'done',
  })
  if (status === 'done') {
    store.reorderCompletedToBottom(props.task.date)
  } else if (status === 'waiting_pm') {
    store.moveTaskToPendingBottom(props.task.id)
  }
}

function onLabelsChange(labels: string[]) {
  store.updateTask(props.task.id, { labels })
}

function addNote(content: string) {
  store.createNote(props.task.id, content)
}

function confirmMove() {
  if (moveDateValue.value) {
    store.moveTask(props.task.id, moveDateValue.value)
  }
  showMoveDate.value = false
}

async function onPaste(e: ClipboardEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.subtask') || target.closest('.note')) return

  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) await store.addAttachment('task', props.task.id, file)
    }
  }
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await store.addAttachment('task', props.task.id, file)
  input.value = ''
}

async function onContextPaste() {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'))
      if (type) {
        const blob = await item.getType(type)
        const file = new File([blob], `paste-${Date.now()}.png`, { type })
        await store.addAttachment('task', props.task.id, file)
        break
      }
    }
  } catch {
    fileInput.value?.click()
  }
}
</script>

<template>
  <article
    class="task-card"
    :class="{
      completed: task.completed && !isMigrated,
      migrated: isMigrated,
      dragging: isTaskDragging,
      'drag-over': isTaskDragOver,
    }"
    @contextmenu="onContextMenu"
    @paste="onPaste"
    @click="goToCurrentDate"
    @dragover="!isMigrated && taskDrag?.onDragOver($event, task.id)"
    @drop="!isMigrated && taskDrag?.onDrop($event, task.id)"
  >
    <header class="header" :class="{ 'has-actions': !isMigrated }">
      <span
        v-if="taskDrag && !isMigrated"
        class="drag-handle"
        draggable="true"
        aria-label="拖曳排序"
        @dragstart="taskDrag.onDragStart($event, task.id)"
        @dragend="taskDrag.onDragEnd"
      >
        <AppIcon name="grip-vertical" />
      </span>

      <label v-if="!isMigrated" class="check-wrap">
        <input type="checkbox" :checked="task.completed" @change="onCompleteChange" />
        <span class="check" :class="{ checked: task.completed }">
          <AppIcon v-if="task.completed" name="check" size="xs" class="check-icon" />
        </span>
      </label>

      <span v-else class="migrated-indicator" title="已遷移至目前排程日期">
        <AppIcon name="arrow-right" size="xs" />
      </span>

      <div class="title-cell">
        <h3 v-if="isMigrated" class="title">{{ task.title }}</h3>
        <InlineEditable
          v-else
          :model-value="task.title"
          tag="h3"
          class="title"
          @save="saveTitle"
        />
      </div>

      <div v-if="!isMigrated" class="header-actions">
        <button type="button" class="expand-btn"
          :aria-expanded="expanded"
          @click="toggleExpanded"
        >
          <AppIcon :name="expanded ? 'chevron-down' : 'chevron-right'" />
        </button>
        <button
          type="button"
          class="menu-btn"
          aria-label="更多操作"
          @click.stop="openMenu"
        >
          <AppIcon name="ellipsis" />
        </button>
      </div>

      <div class="meta-cell">
        <template v-if="isMigrated">
          <span class="migrated-tag">已遷移 → {{ migratedTargetLabel }}</span>
        </template>
        <template v-else>
          <div class="meta-primary">
            <div class="status-row">
              <TaskStatusDropdown
                :model-value="task.status"
                @update:model-value="onStatusChange"
              />
              <TaskLabelsDropdown
                :model-value="task.labels"
                @update:model-value="onLabelsChange"
              />
              <div class="status-hours">
                <input
                  v-model="hoursDraft"
                  type="text"
                  inputmode="decimal"
                  class="hours-input"
                  placeholder="0"
                  aria-label="狀態時數"
                  @click.stop
                  @blur="commitHours"
                  @keydown="onHoursKeydown"
                />
                <span class="hours-unit">h</span>
              </div>
            </div>
          </div>
          <div v-show="expanded" class="difficulty-row" @click.stop>
            <span class="difficulty-label">困難點</span>
            <SearchableCombobox
              class="difficulty-note"
              :model-value="task.difficultyNote"
              :options="difficultyOptions"
              placeholder="輸入或選擇歷史紀錄…"
              empty-text="尚無歷史紀錄"
              @commit="onDifficultyNoteCommit"
              @select="onDifficultyNoteCommit"
            />
          </div>
        </template>
      </div>
    </header>

    <div v-show="expanded && !isMigrated" class="body">
      <AttachmentList
        :attachments="task.attachments"
        @preview="emit('preview', $event)"
      />

      <div class="section">
        <div class="section-header">
          <p class="section-title">
            子任務
            <span v-if="subtaskProgress.total" class="section-count">
              {{ subtaskProgress.done }}/{{ subtaskProgress.total }}
            </span>
          </p>
          <button type="button" class="add-btn" @click="addSubtaskInline">
            + 新增
          </button>
        </div>
        <SubTaskItem
          v-for="sub in task.subtasks"
          :key="sub.id"
          :subtask="sub"
          :task-id="task.id"
          :autofocus="pendingFocusSubtaskId === sub.id"
          @preview="emit('preview', $event)"
        />
      </div>

      <div class="section">
        <div class="section-header">
          <p class="section-title">備註 / 進度</p>
          <button type="button" class="add-btn" @click="showNoteModal = true">
            + 新增
          </button>
        </div>
        <NoteBlock
          v-for="note in task.notes"
          :key="note.id"
          :note="note"
          :task-id="task.id"
          @preview="emit('preview', $event)"
        />
        <InlineEditable
          v-if="!task.notes.length"
          model-value=""
          tag="p"
          class="empty-hint"
          hint
          placeholder="尚無備註"
          @save="saveEmptyNote"
        />
      </div>
    </div>

    <TaskContextMenu
      :items="menuItems"
      :x="menuX"
      :y="menuY"
      :visible="menuVisible"
      @select="onMenuSelect"
      @close="menuVisible = false"
    />

    <TaskFormModal
      :visible="showEditModal"
      mode="edit"
      :task="task"
      @close="showEditModal = false"
      @saved="showEditModal = false"
    />

    <ConfirmDialog
      :visible="showDeleteConfirm"
      title="刪除任務"
      :message="`確定要刪除「${task.title}」嗎？此操作將一併刪除所有子任務、備註與附件。`"
      confirm-label="刪除"
      cancel-label="取消"
      danger
      @confirm="confirmDelete"
      @close="showDeleteConfirm = false"
    />

    <ConfirmDialog
      :visible="showCompleteConfirm"
      title="尚有未完成的子任務"
      :message="`此任務還有 ${incompleteSubtaskCount} 項子任務未完成，是否一併標記為已完成？`"
      confirm-label="是"
      cancel-label="否"
      @confirm="confirmCompleteWithSubtasks"
      @close="showCompleteConfirm = false"
    />

    <QuickInputModal
      :visible="showNoteModal"
      title="新增備註"
      placeholder="輸入備註或目前進度..."
      multiline
      @confirm="addNote"
      @close="showNoteModal = false"
    />

    <Teleport to="body">
      <div v-if="showMoveDate" class="picker-overlay" @click.self="showMoveDate = false">
        <div class="picker-panel">
          <h4>移動到其他日期</h4>
          <input v-model="moveDateValue" type="date" />
          <div class="picker-actions">
            <button type="button" @click="showMoveDate = false">取消</button>
            <button type="button" class="confirm" @click="confirmMove">確認</button>
          </div>
        </div>
      </div>
    </Teleport>

    <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.task-card {
  width: 100%;
  box-sizing: border-box;
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow;
  padding: 16px 18px;
  border: 1px solid $border;
  transition: opacity 0.2s, transform 0.15s, box-shadow 0.15s;

  &.dragging {
    opacity: 0.45;
  }

  &.drag-over {
    transform: translateY(2px);
    box-shadow: $shadow, 0 -2px 0 0 $primary inset;
  }

  &.completed {
    opacity: 0.72;

    .title {
      color: $text-muted;
      text-decoration: line-through;
    }
  }

  &.migrated {
    opacity: 0.55;
    cursor: pointer;
    background: $bg;

    .title {
      color: $text-muted;
      text-decoration: none;
    }

    &:hover {
      opacity: 0.7;
    }
  }
}

.header {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  grid-template-areas:
    'drag check title actions'
    '. meta meta meta';
  align-items: start;
  gap: 6px 8px;
}

.header:not(.has-actions) {
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas:
    'check title'
    '. meta';
}

.drag-handle {
  grid-area: drag;
  padding-top: 4px;
  color: $text-muted;
  font-size: 16px;
  cursor: grab;
  opacity: 0.4;
  line-height: 1;
  flex-shrink: 0;
  user-select: none;

  &:hover {
    opacity: 0.8;
  }

  &:active {
    cursor: grabbing;
  }
}

.check-wrap {
  grid-area: check;
  padding-top: 4px;
  cursor: pointer;

  input {
    display: none;
  }
}

.check {
  width: 20px;
  height: 20px;
  border: 2px solid #d1d5db;
  border-radius: 6px;
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

.title-cell {
  grid-area: title;
  min-width: 0;
}

.meta-cell {
  grid-area: meta;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  width: 100%;
}

.title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 0;
}

.meta-primary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  width: 100%;
}

.status-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.status-hours {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px 2px 6px;
  border-radius: 20px;
  background: $bg;
  border: 1px solid $border;

  &:focus-within {
    border-color: $primary;
    box-shadow: 0 0 0 2px $primary-light;
  }
}

.hours-input {
  width: 48px;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  color: $text;
  text-align: right;

  &:focus {
    outline: none;
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  appearance: textfield;
  -moz-appearance: textfield;
}

.hours-unit {
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
}

.difficulty-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.difficulty-label {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
  white-space: nowrap;
}

.difficulty-note {
  flex: 1;
  min-width: 0;
}

.carried {
  font-size: 11px;
  color: $text-muted;
  font-style: italic;
}

.migrated-indicator {
  grid-area: check;
  width: 20px;
  height: 20px;
  padding-top: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $text-muted;
  flex-shrink: 0;
}

.migrated-tag {
  font-size: 11px;
  color: $text-muted;
  font-style: italic;
}

.header-actions {
  grid-area: actions;
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.expand-btn,
.menu-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: $text-muted;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: $bg;
    color: $primary;
  }
}

.body {
  margin-top: 12px;
  padding-left: 32px;
  min-width: 0;
  max-width: 100%;
  // 用 clip 而非 hidden：clip 不會建立捲動容器，
  // 備註操作列的 position: sticky 才能相對於視窗捲動生效
  overflow: clip;
}

.section {
  margin-top: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.section-count {
  margin-left: 6px;
  color: $primary;
  font-weight: 700;
}

.add-btn {
  font-size: 12px;
  color: $primary;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;

  &:hover {
    background: $primary-light;
  }
}

.empty-hint {
  font-size: 12px;
  padding: 4px 0;
}

.picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 1300;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.picker-panel {
  background: $surface;
  border-radius: $radius;
  padding: 20px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  h4 {
    font-size: 14px;
    font-weight: 600;
  }

  input[type='date'] {
    padding: 8px;
    border: 1px solid $border;
    border-radius: $radius-sm;
  }
}

.picker-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;

  .confirm {
    background: $primary;
    color: white;
    padding: 6px 14px;
    border-radius: $radius-sm;
  }
}

@media (max-width: $breakpoint-sm) {
  .task-card {
    padding: 14px 12px;
  }

  .header.has-actions {
    grid-template-columns: auto auto 1fr;
    grid-template-areas:
      'drag check actions'
      'title title title'
      '. meta meta';
  }

  .body {
    padding-left: 0;
  }
}

@media (max-width: $breakpoint-xs) {
  .meta-primary {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }

  .status-row {
    width: 100%;
  }

  .difficulty-row {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }

  .difficulty-label {
    font-size: 10px;
  }

  .header-actions {
    align-self: start;
  }
}
</style>
