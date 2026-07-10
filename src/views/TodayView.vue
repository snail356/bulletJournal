<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import type { Attachment, Task } from '@/types'
import TaskCard from '@/components/TaskCard.vue'
import TaskFormModal from '@/components/TaskFormModal.vue'
import AttachmentPreview from '@/components/AttachmentPreview.vue'
import ConfirmOrUndoToast from '@/components/ConfirmOrUndoToast.vue'
import AppIcon from '@/components/AppIcon.vue'
import AppSwitch from '@/components/AppSwitch.vue'
import { TASK_DRAG_KEY } from '@/composables/taskDrag'
import { useReorderDrag } from '@/composables/useReorderDrag'
import { useTaskStore } from '@/stores/taskStore'
import { formatDisplayDate } from '@/utils/date'

const store = useTaskStore()
const showCreateModal = ref(false)
const previewAttachment = ref<Attachment | null>(null)
const toastVisible = ref(false)
const toastMessage = ref('')
const deletedTaskBackup = ref<Task | null>(null)

const taskViews = computed(() => store.getTasksByDate(store.selectedDate))
const activeTasks = computed(() =>
  taskViews.value.filter((v) => !v.migratedAway).map((v) => v.task),
)
const dateLabel = computed(() => formatDisplayDate(store.selectedDate))
const progress = computed(() => store.todayProgress)

const taskDrag = useReorderDrag<Task>(
  () => activeTasks.value,
  (fromId, toId) => store.reorderTasks(store.selectedDate, fromId, toId),
)
provide(TASK_DRAG_KEY, taskDrag)

function onTaskDeleted(task: Task) {
  deletedTaskBackup.value = JSON.parse(JSON.stringify(task)) as Task
  store.deleteTask(task.id)
  toastMessage.value = `已刪除「${task.title}」`
  toastVisible.value = true
}

function undoDelete() {
  if (deletedTaskBackup.value) {
    store.tasks.push(deletedTaskBackup.value)
    deletedTaskBackup.value = null
  }
}
</script>

<template>
  <div class="today-view">
    <header class="page-header">
      <div>
        <h1>{{ dateLabel }}</h1>
        <p class="subtitle">
          {{ progress.completed }} / {{ progress.total }} 項任務已完成
        </p>
      </div>
      <div class="header-actions">
        <AppSwitch
          :model-value="store.expandAllTasks"
          label="展開任務"
          @update:model-value="store.expandAllTasks = $event"
        />
        <AppSwitch
          :model-value="store.expandImages"
          label="展開圖片"
          @update:model-value="store.expandImages = $event"
        />
        <button type="button" class="btn-primary" @click="showCreateModal = true">
          + 新增任務
        </button>
      </div>
    </header>

    <div v-if="taskViews.length" class="task-list">
      <TaskCard
        v-for="view in taskViews"
        :key="view.migratedAway ? `${view.task.id}-migrated` : view.task.id"
        :task="view.task"
        :migrated-away="view.migratedAway"
        @preview="previewAttachment = $event"
        @deleted="onTaskDeleted"
      />
    </div>

    <div v-else class="empty">
      <AppIcon name="clipboard-list" size="lg" class="empty-icon" />
      <p>今天還沒有任務</p>
      <button type="button" class="btn-primary" @click="showCreateModal = true">
        建立第一個任務
      </button>
    </div>

    <TaskFormModal
      :visible="showCreateModal"
      mode="create"
      :default-date="store.selectedDate"
      @close="showCreateModal = false"
      @saved="showCreateModal = false"
    />

    <AttachmentPreview
      :attachment="previewAttachment"
      @close="previewAttachment = null"
    />

    <ConfirmOrUndoToast
      :visible="toastVisible"
      :message="toastMessage"
      @undo="undoDelete"
      @close="toastVisible = false"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.today-view {
  width: 100%;
  max-width: none;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;

  h1 {
    font-size: 24px;
    font-weight: 700;
    color: $text;
  }
}

.subtitle {
  color: $text-muted;
  font-size: 13px;
  margin-top: 4px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.btn-primary {
  padding: 10px 18px;
  background: $primary;
  color: white;
  border-radius: $radius-sm;
  font-weight: 600;
  white-space: nowrap;

  &:hover {
    background: $primary-dark;
  }
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  background: $surface;
  border-radius: $radius;
  border: 1px dashed $border;

  .empty-icon {
    font-size: 48px;
    display: block;
    margin: 0 auto 12px;
    color: $text-muted;
    opacity: 0.5;
  }

  p {
    color: $text-muted;
    margin-bottom: 16px;
  }
}

@media (max-width: $breakpoint-md) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .btn-primary {
    width: 100%;
    text-align: center;
  }
}

@media (max-width: $breakpoint-xs) {
  .page-header h1 {
    font-size: 20px;
  }

  .header-actions {
    gap: 8px;
  }
}
</style>
