<script setup lang="ts">
import { ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useTaskStore } from '@/stores/taskStore'
import { mockLabels, mockTasks } from '@/mock/data'
import { TASKS_KEY, LABELS_KEY, SELECTED_DATE_KEY, saveToStorage } from '@/utils/storage'
import { todayString } from '@/utils/date'

const store = useTaskStore()
const message = ref('')
const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmDanger = ref(false)
let confirmAction: (() => void) | null = null

function openConfirm(
  title: string,
  msg: string,
  action: () => void,
  options?: { danger?: boolean },
) {
  confirmTitle.value = title
  confirmMessage.value = msg
  confirmDanger.value = options?.danger ?? false
  confirmAction = action
  confirmVisible.value = true
}

function onConfirm() {
  confirmAction?.()
}

function resetMockData() {
  openConfirm(
    '重置為 Mock 資料',
    '確定要重置為 mock 假資料？所有變更將遺失。',
    () => {
      store.tasks = [...mockTasks]
      store.labels = [...mockLabels]
      store.setSelectedDate(todayString())
      saveToStorage(TASKS_KEY, store.tasks)
      saveToStorage(LABELS_KEY, store.labels)
      saveToStorage(SELECTED_DATE_KEY, store.selectedDate)
      message.value = '已重置為 mock 資料'
      setTimeout(() => (message.value = ''), 3000)
    },
  )
}

function clearStorage() {
  openConfirm(
    '清除所有資料',
    '確定要清除所有 localStorage 資料？此操作無法復原。',
    () => {
      localStorage.removeItem(TASKS_KEY)
      localStorage.removeItem(LABELS_KEY)
      localStorage.removeItem(SELECTED_DATE_KEY)
      location.reload()
    },
    { danger: true },
  )
}
</script>

<template>
  <div class="settings-view">
    <header class="page-header">
      <h1>設定</h1>
      <p class="subtitle">應用程式偏好與資料管理</p>
    </header>

    <div class="settings-card">
      <h2>資料管理</h2>
      <p class="desc">所有資料儲存於瀏覽器 localStorage，無需後端。</p>
      <div class="actions">
        <button type="button" class="btn-secondary" @click="resetMockData">
          重置為 Mock 資料
        </button>
        <button type="button" class="btn-danger" @click="clearStorage">
          清除所有資料
        </button>
      </div>
      <p v-if="message" class="feedback">{{ message }}</p>
    </div>

    <div class="settings-card">
      <h2>關於</h2>
      <p class="desc">Bullet Journal 工作狀態紀錄 Web App</p>
      <ul class="info">
        <li>Vue 3 + Vite + TypeScript</li>
        <li>Pinia + Vue Router</li>
        <li>版本 1.0.0</li>
      </ul>
    </div>

    <ConfirmDialog
      :visible="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      :danger="confirmDanger"
      confirm-label="確定"
      cancel-label="取消"
      @confirm="onConfirm"
      @close="confirmVisible = false"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.page-header {
  margin-bottom: 24px;

  h1 {
    font-size: 24px;
    font-weight: 700;
  }
}

.subtitle {
  color: $text-muted;
  font-size: 13px;
  margin-top: 4px;
}

.settings-card {
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow;
  padding: 24px;
  margin-bottom: 16px;

  h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
  }
}

.desc {
  color: $text-muted;
  font-size: 13px;
  margin-bottom: 16px;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  color: $text;

  &:hover {
    border-color: $primary;
    color: $primary;
  }
}

.btn-danger {
  padding: 8px 16px;
  background: #fef2f2;
  color: #ef4444;
  border-radius: $radius-sm;
  font-weight: 500;

  &:hover {
    background: #fee2e2;
  }
}

.feedback {
  margin-top: 12px;
  color: #22c55e;
  font-size: 13px;
}

.info {
  font-size: 13px;
  color: $text-muted;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
