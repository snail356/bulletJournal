<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Attachment, Task, TaskStatus } from '@/types'
import SubTaskItem from './SubTaskItem.vue'
import NoteBlock from './NoteBlock.vue'
import AttachmentList from './AttachmentList.vue'
import TaskContextMenu from './TaskContextMenu.vue'
import type { ContextMenuItem } from './TaskContextMenu.vue'
import TaskFormModal from './TaskFormModal.vue'
import TaskStatusDropdown from './TaskStatusDropdown.vue'
import QuickInputModal from './QuickInputModal.vue'
import { useTaskStore } from '@/stores/taskStore'

const props = defineProps<{
  task: Task
}>()

const emit = defineEmits<{
  preview: [attachment: Attachment]
  deleted: [task: Task]
}>()

const store = useTaskStore()
const menuVisible = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const showEditModal = ref(false)
const showSubtaskModal = ref(false)
const showNoteModal = ref(false)
const showMoveDate = ref(false)
const moveDateValue = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const expanded = ref(true)

const labelNames = computed(() =>
  props.task.labels
    .map((id) => store.labels.find((l) => l.id === id)?.name)
    .filter(Boolean),
)

const subtaskProgress = computed(() => {
  const total = props.task.subtasks.length
  const done = props.task.subtasks.filter((s) => s.completed).length
  return { total, done }
})

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
  e.preventDefault()
  openMenu(e)
}

function toggleComplete() {
  store.toggleTask(props.task.id)
}

function onMenuSelect(key: string) {
  menuVisible.value = false
  switch (key) {
    case 'edit':
      showEditModal.value = true
      break
    case 'add-subtask':
      showSubtaskModal.value = true
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
      emit('deleted', props.task)
      break
  }
}

function onStatusChange(status: TaskStatus) {
  store.updateTask(props.task.id, {
    status,
    completed: status === 'done',
  })
  if (status === 'done') store.reorderCompletedToBottom(props.task.date)
}

function addSubtask(title: string) {
  store.createSubTask(props.task.id, title)
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
    :class="{ completed: task.completed }"
    @contextmenu="onContextMenu"
    @paste="onPaste"
  >
    <header class="header">
      <label class="check-wrap">
        <input type="checkbox" :checked="task.completed" @change="toggleComplete" />
        <span class="check" />
      </label>

      <div class="title-area">
        <h3 class="title">{{ task.title }}</h3>
        <div class="meta">
          <TaskStatusDropdown
            :model-value="task.status"
            @update:model-value="onStatusChange"
          />
          <span v-for="name in labelNames" :key="name" class="label-tag">{{ name }}</span>
          <span v-if="task.carriedFromDate" class="carried">延續自 {{ task.carriedFromDate }}</span>
        </div>
      </div>

      <div class="header-actions">
        <button
          type="button"
          class="expand-btn"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          {{ expanded ? '▾' : '▸' }}
        </button>
        <button type="button" class="menu-btn" aria-label="更多操作" @click="openMenu">⋯</button>
      </div>
    </header>

    <div v-show="expanded" class="body">
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
          <button type="button" class="add-btn" @click="showSubtaskModal = true">
            + 新增
          </button>
        </div>
        <SubTaskItem
          v-for="sub in task.subtasks"
          :key="sub.id"
          :subtask="sub"
          :task-id="task.id"
          @preview="emit('preview', $event)"
        />
        <p v-if="!task.subtasks.length" class="empty-hint">尚無子任務</p>
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
        <p v-if="!task.notes.length" class="empty-hint">尚無備註</p>
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

    <QuickInputModal
      :visible="showSubtaskModal"
      title="新增子任務"
      placeholder="輸入子任務標題..."
      @confirm="addSubtask"
      @close="showSubtaskModal = false"
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
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow;
  padding: 16px 18px;
  border: 1px solid $border;
  transition: opacity 0.2s;

  &.completed {
    opacity: 0.72;

    .title {
      color: $text-muted;
      text-decoration: line-through;
    }
  }
}

.header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.check-wrap {
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
  display: block;
}

input:checked + .check {
  background: $primary;
  border-color: $primary;
  position: relative;

  &::after {
    content: '✓';
    position: absolute;
    inset: 0;
    color: white;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.title-area {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.label-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 20px;
  background: $bg;
  color: $text-muted;
}

.carried {
  font-size: 11px;
  color: $text-muted;
  font-style: italic;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.expand-btn,
.menu-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: $text-muted;
  font-size: 16px;

  &:hover {
    background: $bg;
    color: $primary;
  }
}

.body {
  margin-top: 12px;
  padding-left: 32px;
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
  color: $text-muted;
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
</style>
