<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Attachment, Task } from '@/types'
import TaskCard from '@/components/TaskCard.vue'
import TaskFormModal from '@/components/TaskFormModal.vue'
import AttachmentPreview from '@/components/AttachmentPreview.vue'
import ConfirmOrUndoToast from '@/components/ConfirmOrUndoToast.vue'
import { useTaskStore } from '@/stores/taskStore'
import { formatDisplayDate } from '@/utils/date'

const store = useTaskStore()
const showCreateModal = ref(false)
const previewAttachment = ref<Attachment | null>(null)
const toastVisible = ref(false)
const toastMessage = ref('')
const deletedTaskBackup = ref<Task | null>(null)

const tasks = computed(() => store.getTasksByDate(store.selectedDate))
const dateLabel = computed(() => formatDisplayDate(store.selectedDate))
const progress = computed(() => store.todayProgress)

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
      <button type="button" class="btn-primary" @click="showCreateModal = true">
        + 新增任務
      </button>
    </header>

    <div v-if="tasks.length" class="task-list">
      <TaskCard
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        @preview="previewAttachment = $event"
        @deleted="onTaskDeleted"
      />
    </div>

    <div v-else class="empty">
      <span class="empty-icon">📝</span>
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
  max-width: 800px;
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
    margin-bottom: 12px;
  }

  p {
    color: $text-muted;
    margin-bottom: 16px;
  }
}
</style>
