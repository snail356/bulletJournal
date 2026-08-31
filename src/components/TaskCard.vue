<script setup lang="ts">
import { computed, inject, nextTick, provide, ref, watch } from 'vue'
import type { Attachment, SubTask, Task } from '@/types'
import {
  formatDisplayDate,
  formatShortDate,
  getOriginalScheduledDate,
  getPostponedDays,
  getTaskEndDate,
  normalizeEndDate,
} from '@/utils/date'
import SubTaskItem from './SubTaskItem.vue'
import TaskBodySection from './TaskBodySection.vue'
import NoteBlock from './NoteBlock.vue'
import TaskContextMenu from './TaskContextMenu.vue'
import type { ContextMenuItem } from './TaskContextMenu.vue'
import TaskFormModal from './TaskFormModal.vue'
import TaskStatusDropdown from './TaskStatusDropdown.vue'
import TaskAvatarDropdown from './TaskAvatarDropdown.vue'
import TaskAvatarFace from './TaskAvatarFace.vue'
import TaskLabelsDropdown from './TaskLabelsDropdown.vue'
import QuickInputModal from './QuickInputModal.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import AppIcon from './AppIcon.vue'
import InlineEditable from './InlineEditable.vue'
import { SUBTASK_DRAG_KEY, TASK_DRAG_KEY } from '@/composables/taskDrag'
import { useReorderDrag } from '@/composables/useReorderDrag'
import { useTaskStore } from '@/stores/taskStore'
import { getNotesExpanded, setNotesExpanded } from '@/utils/sectionCollapseState'
import {
  getSubtasksExpanded,
  setSubtasksExpanded,
} from '@/utils/sectionCollapseState'

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
const avatar = computed(() => store.getTaskAvatar(props.task.avatarId))

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
const showCompleteConfirm = ref(false)
const pendingFocusSubtaskId = ref<string | null>(null)
const datePickerMode = ref<'start' | 'end' | 'move' | null>(null)
const datePickerValue = ref('')
const datePickerInput = ref<HTMLInputElement | null>(null)
const datePickerApplying = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const hoursInput = ref<HTMLInputElement | null>(null)
const expanded = ref(store.expandAllTasks)
const notesExpanded = ref(getNotesExpanded(props.task.id, true))
const subtasksExpanded = ref(getSubtasksExpanded(props.task.id, true))

watch(
  () => store.expandAllTasks,
  (v) => {
    expanded.value = v
  },
)

watch(notesExpanded, (value) => {
  setNotesExpanded(props.task.id, value)
})

watch(subtasksExpanded, (value) => {
  setSubtasksExpanded(props.task.id, value)
})

watch(
  () => props.task.id,
  (taskId) => {
    notesExpanded.value = getNotesExpanded(taskId, true)
    subtasksExpanded.value = getSubtasksExpanded(taskId, true)
  },
)

function toggleExpanded() {
  expanded.value = !expanded.value
}

function toggleNotesExpanded() {
  notesExpanded.value = !notesExpanded.value
}

function toggleSubtasksExpanded() {
  subtasksExpanded.value = !subtasksExpanded.value
}

const notesPreview = computed(() => {
  const notes = props.task.notes
  if (!notes.length) return '尚無備註'
  const latest = notes[notes.length - 1]
  const text = latest.content.trim().replace(/\s+/g, ' ')
  const snippet = text.length > 48 ? `${text.slice(0, 48)}…` : text || '（空白備註）'
  return notes.length === 1 ? snippet : `${notes.length} 則 · ${snippet}`
})

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

const postponedDays = computed(() => getPostponedDays(props.task))

const postponedLabel = computed(() => {
  if (postponedDays.value <= 0) return ''
  return `原排程 ${formatDisplayDate(getOriginalScheduledDate(props.task))}`
})

const startDateLabel = computed(() => formatShortDate(props.task.date))
const endDateLabel = computed(() => formatShortDate(getTaskEndDate(props.task)))

const datePickerMin = computed(() =>
  datePickerMode.value === 'end' ? props.task.date : undefined,
)

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

function selectHoursInput() {
  const input = hoursInput.value
  if (!input) return
  input.focus()
  nextTick(() => input.select())
}

function onHoursFocus(e: FocusEvent) {
  const input = e.target as HTMLInputElement
  nextTick(() => input.select())
}

function onHoursClick(e: MouseEvent) {
  const input = e.target as HTMLInputElement
  nextTick(() => input.select())
}

function onStatusHoursClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.hours-input')) return
  selectHoursInput()
}

function goToCurrentDate() {
  if (!isMigrated.value) return
  store.setSelectedDate(props.task.date)
}

const menuItems = computed<ContextMenuItem[]>(() => [
  { key: 'edit', label: '編輯任務' },
  { key: 'add-subtask', label: '新增子任務' },
  { key: 'add-note', label: '新增備註' },
  { key: 'paste-image', label: '貼上圖片' },
  { key: 'duplicate', label: '複製任務' },
  { key: 'move', label: '移動到其他日期' },
  {
    key: 'delete',
    label: '刪除任務',
    danger: true,
    divider: true,
    confirmTitle: '刪除任務',
    confirmMessage: `確定要刪除「${props.task.title}」嗎？此操作將一併刪除所有子任務、備註與附件。`,
  },
])

function openMenu(e: MouseEvent) {
  menuX.value = e.clientX
  menuY.value = e.clientY
  menuVisible.value = true
}

function onContextMenu(e: MouseEvent) {
  if (isMigrated.value) return
  const target = e.target as HTMLElement | null
  // 輸入區保留瀏覽器原生選單（複製／貼上），不開主任務選單
  if (
    target?.closest(
      'textarea, input, [contenteditable="true"], .inline-editable.editing, .body-section, .note, .subtask',
    )
  ) {
    return
  }
  e.preventDefault()
  openMenu(e)
}

function saveTitle(title: string) {
  if (isMigrated.value) return
  store.updateTask(props.task.id, { title })
}

function addSubtaskInline() {
  // 新增子任務時自動展開，避免使用者看不到剛建立的項目
  subtasksExpanded.value = true
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
  notesExpanded.value = true
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
      notesExpanded.value = true
      showNoteModal.value = true
      break
    case 'paste-image':
      onContextPaste()
      break
    case 'duplicate':
      store.duplicateTask(props.task.id)
      break
    case 'move':
      openDatePicker('move')
      break
    case 'delete':
      emit('deleted', props.task)
      break
  }
}

function openDatePicker(mode: 'start' | 'end' | 'move') {
  datePickerMode.value = mode
  datePickerApplying.value = false
  if (mode === 'end') {
    datePickerValue.value = getTaskEndDate(props.task)
  } else {
    datePickerValue.value = props.task.date
  }
  nextTick(() => {
    const el = datePickerInput.value
    if (!el) return
    el.focus({ preventScroll: true })
    try {
      el.showPicker?.()
    } catch {
      /* 部分瀏覽器不支援或需使用者手勢，略過即可 */
    }
  })
}

function closeDatePicker() {
  datePickerMode.value = null
  datePickerApplying.value = false
}

function applySelectedDate(value: string) {
  if (!value || !datePickerMode.value) {
    closeDatePicker()
    return
  }

  if (datePickerMode.value === 'move') {
    store.moveTask(props.task.id, value)
  } else if (datePickerMode.value === 'start') {
    store.setTaskDateRange(
      props.task.id,
      value,
      normalizeEndDate(value, props.task.endDate),
    )
  } else {
    store.setTaskDateRange(
      props.task.id,
      props.task.date,
      normalizeEndDate(props.task.date, value),
    )
  }
  closeDatePicker()
}

function onDatePickerChange(e: Event) {
  if (!datePickerMode.value) return
  const value = (e.target as HTMLInputElement).value
  datePickerApplying.value = true
  applySelectedDate(value)
}

function onDatePickerBlur() {
  if (!datePickerMode.value) return
  // 原生日曆彈層互動時可能短暫失焦，稍等再決定是否取消
  window.setTimeout(() => {
    if (!datePickerMode.value || datePickerApplying.value) return
    if (document.activeElement === datePickerInput.value) return
    closeDatePicker()
  }, 150)
}

function onDatePickerKeydown(e: KeyboardEvent) {
  if (!datePickerMode.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    closeDatePicker()
  }
}

function onStatusChange(status: string) {
  store.applyTaskStatus(props.task.id, status)
}

function onLabelsChange(labels: string[]) {
  store.updateTask(props.task.id, { labels })
}

function addNote(content: string) {
  store.createNote(props.task.id, content)
  notesExpanded.value = true
}

async function onPaste(e: ClipboardEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.subtask') || target.closest('.note') || target.closest('.body-section')) return

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
        <TaskAvatarDropdown
          v-if="avatar && !isMigrated"
          :model-value="task.avatarId"
          @update:model-value="store.updateTask(task.id, { avatarId: $event })"
        />
        <span v-else-if="avatar" class="task-avatar" :title="avatar.name">
          <TaskAvatarFace :avatar="avatar" size="sm" />
        </span>
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
              <div class="date-field">
                <div class="date-range" :title="`${task.date} ～ ${getTaskEndDate(task)}`">
                  <button
                    type="button"
                    class="date-part"
                    :class="{ active: datePickerMode === 'start' || datePickerMode === 'move' }"
                    title="重新選擇開始日期"
                    @mousedown.prevent
                    @click.stop="openDatePicker('start')"
                  >
                    <span class="hours-label">開始</span>
                    <span class="date-value">{{ startDateLabel }}</span>
                  </button>
                  <button
                    type="button"
                    class="date-part"
                    :class="{ active: datePickerMode === 'end' }"
                    title="重新選擇結束日期"
                    @mousedown.prevent
                    @click.stop="openDatePicker('end')"
                  >
                    <span class="hours-label">結束</span>
                    <span class="date-value">{{ endDateLabel }}</span>
                  </button>
                </div>
                <input
                  ref="datePickerInput"
                  v-model="datePickerValue"
                  type="date"
                  class="hidden-date-picker"
                  :class="{
                    'under-end': datePickerMode === 'end',
                  }"
                  :min="datePickerMin"
                  tabindex="-1"
                  :aria-hidden="!datePickerMode"
                  :aria-label="
                    datePickerMode === 'end'
                      ? '選擇結束日期'
                      : datePickerMode === 'move'
                        ? '移動到其他日期'
                        : '選擇開始日期'
                  "
                  @change="onDatePickerChange"
                  @blur="onDatePickerBlur"
                  @keydown="onDatePickerKeydown"
                />
              </div>
              <TaskStatusDropdown
                :model-value="task.status"
                @update:model-value="onStatusChange"
              />
              <TaskLabelsDropdown
                :model-value="task.labels"
                @update:model-value="onLabelsChange"
              />
              <div class="meta-end">
                <div class="status-hours" @click.stop="onStatusHoursClick">
                  <span class="hours-label">時數</span>
                  <input
                    ref="hoursInput"
                    v-model="hoursDraft"
                    type="text"
                    inputmode="decimal"
                    class="hours-input"
                    placeholder="0"
                    aria-label="狀態時數"
                    @focus="onHoursFocus"
                    @click="onHoursClick"
                    @blur="commitHours"
                    @keydown="onHoursKeydown"
                  />
                  <span class="hours-unit">h</span>
                </div>
                <span
                  v-if="postponedDays > 0"
                  class="postponed-tag"
                  :title="postponedLabel"
                >
                  推延 {{ postponedDays }} 天
                </span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </header>

    <div v-show="expanded && !isMigrated" class="body">
      <TaskBodySection
        :task-id="task.id"
        :content="task.bodyContent"
        :content-type="task.bodyContentType"
        :attachments="task.attachments"
        @preview="emit('preview', $event)"
      />

      <div class="section">
        <div class="section-header">
          <button
            type="button"
            class="section-toggle"
            :aria-expanded="subtasksExpanded"
            @click="toggleSubtasksExpanded"
          >
            <AppIcon :name="subtasksExpanded ? 'chevron-down' : 'chevron-right'" size="xs" />
            <p class="section-title">
              子任務
              <span v-if="subtaskProgress.total" class="section-count">
                {{ subtaskProgress.done }}/{{ subtaskProgress.total }}
              </span>
            </p>
          </button>
          <button type="button" class="add-btn" @click="addSubtaskInline">
            + 新增
          </button>
        </div>

        <template v-if="subtasksExpanded">
          <SubTaskItem
            v-for="sub in task.subtasks"
            :key="sub.id"
            :subtask="sub"
            :task-id="task.id"
            :autofocus="pendingFocusSubtaskId === sub.id"
            @preview="emit('preview', $event)"
          />
        </template>
      </div>

      <div class="section">
        <div class="section-header">
          <button
            type="button"
            class="section-toggle"
            :aria-expanded="notesExpanded"
            @click="toggleNotesExpanded"
          >
            <AppIcon
              :name="notesExpanded ? 'chevron-down' : 'chevron-right'"
              size="xs"
            />
            <p class="section-title">
              備註 / 進度
              <span v-if="task.notes.length" class="section-count">
                {{ task.notes.length }}
              </span>
            </p>
          </button>
          <button type="button" class="add-btn" @click="showNoteModal = true">
            + 新增
          </button>
        </div>
        <p
          v-if="!notesExpanded && task.notes.length"
          class="notes-collapsed-preview"
          @click="notesExpanded = true"
        >
          {{ notesPreview }}
        </p>
        <template v-else>
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
        </template>
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
  align-items: center;
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
  color: $text-muted;
  font-size: 16px;
  cursor: grab;
  opacity: 0.4;
  line-height: 1;
  display: flex;
  align-items: center;
  height: 20px;
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
  cursor: pointer;
  display: flex;
  align-items: center;
  height: 20px;

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
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 20px;
}

.task-avatar {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: $primary-light;
  color: $primary;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
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
  margin: 0;
  min-width: 0;
  flex: 1;
  line-height: 20px;
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
  width: 100%;
}

.date-field {
  position: relative;
  display: inline-flex;
  align-items: baseline;
}

.date-range {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
}

.date-part {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding: 2px 4px;
  margin: -2px -4px;
  border-radius: 4px;
  color: inherit;

  &:hover,
  &.active {
    background: $bg;

    .date-value {
      color: $primary;
    }
  }
}

.date-value {
  font-size: 13px;
  font-weight: 500;
  color: $text-muted;
  white-space: nowrap;
}

/* 只用來掛原生日曆，不佔版面、不顯示輸入框 */
.hidden-date-picker {
  position: absolute;
  left: 0;
  top: 100%;
  width: 1px;
  height: 1px;
  margin: 0;
  padding: 0;
  border: 0;
  opacity: 0;
  overflow: hidden;

  &.under-end {
    left: auto;
    right: 0;
  }
}

.meta-end {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.status-hours {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 4px 10px 4px 10px;
  border-radius: $radius-sm;
  background: $bg;
  border: 1px solid $border;
  cursor: text;

  &:hover {
    border-color: #d1d5db;
  }

  &:focus-within {
    border-color: $primary;
    box-shadow: 0 0 0 2px $primary-light;
    background: $surface;
  }
}

.hours-label {
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
  white-space: nowrap;
  user-select: none;
}

.hours-input {
  width: 4.5ch;
  min-width: 4.5ch;
  max-width: 8ch;
  field-sizing: content;
  padding: 2px 0;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: $text;
  text-align: right;
  line-height: 1.3;

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
  font-size: 12px;
  font-weight: 600;
  color: $text-muted;
}

.postponed-tag {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 4px 10px;
  border-radius: $radius-sm;
  font-size: 12px;
  font-weight: 600;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
  white-space: nowrap;
  cursor: default;
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

.notes-collapsed-preview {
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

  .status-hours {
    flex: 1 1 auto;
    min-width: 120px;
  }

  .hours-input {
    flex: 1;
    width: auto;
    min-width: 4.5ch;
    max-width: none;
    text-align: left;
  }

  .header-actions {
    align-self: start;
  }
}
</style>
