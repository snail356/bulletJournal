<script setup lang="ts">
import { computed, ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useTaskStore } from '@/stores/taskStore'
import type { DifficultyNoteRecord } from '@/types'

const store = useTaskStore()
const keyword = ref('')
const confirmVisible = ref(false)
const pendingDelete = ref<DifficultyNoteRecord | null>(null)

const records = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  const list = store.difficultyNoteRecordsSorted
  if (!query) return list
  return list.filter((record) => record.content.toLowerCase().includes(query))
})

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

function requestDelete(record: DifficultyNoteRecord) {
  pendingDelete.value = record
  confirmVisible.value = true
}

function confirmDelete() {
  if (pendingDelete.value) {
    store.deleteDifficultyNote(pendingDelete.value.id)
    pendingDelete.value = null
  }
}

const deleteMessage = computed(() => {
  if (!pendingDelete.value) return ''
  const count = store.getDifficultyNoteTaskCount(pendingDelete.value.content)
  if (count > 0) {
    return `此困難點目前有 ${count} 項任務使用中，刪除後將不再出現於下拉選單（任務上已填寫的文字不受影響）。`
  }
  return '確定刪除此困難點紀錄？'
})
</script>

<template>
  <div class="difficulty-view">
    <header class="page-header">
      <h1>困難點資料</h1>
      <p class="subtitle">
        所有曾經寫入過的困難點內容，作為任務卡下拉選單的統一資料來源
      </p>
    </header>

    <div class="toolbar">
      <input
        v-model="keyword"
        type="text"
        class="search"
        placeholder="搜尋困難點內容…"
      />
      <span class="total">共 {{ store.difficultyNoteRecords.length }} 筆</span>
    </div>

    <div v-if="records.length" class="note-list">
      <div v-for="record in records" :key="record.id" class="note-card">
        <div class="note-main">
          <p class="content">{{ record.content }}</p>
          <div class="meta">
            <span class="chip">使用於 {{ record.usageCount }} 項任務</span>
            <span class="date">最後使用 {{ formatDateTime(record.lastUsedAt) }}</span>
          </div>
        </div>
        <button
          type="button"
          class="delete"
          aria-label="刪除困難點"
          @click="requestDelete(record)"
        >
          <AppIcon name="trash" size="sm" />
        </button>
      </div>
    </div>

    <div v-else class="empty">
      <p v-if="keyword.trim()">找不到符合「{{ keyword.trim() }}」的困難點</p>
      <p v-else>尚無困難點紀錄，於任務卡的困難點欄位輸入後即會自動建立</p>
    </div>

    <ConfirmDialog
      :visible="confirmVisible"
      title="刪除困難點"
      :message="deleteMessage"
      confirm-label="刪除"
      cancel-label="取消"
      danger
      @confirm="confirmDelete"
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

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search {
  flex: 1;
  min-width: 200px;
  padding: 10px 12px;
  border: 1px solid $border;
  border-radius: $radius-sm;

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 3px $primary-light;
  }
}

.total {
  font-size: 13px;
  color: $text-muted;
  white-space: nowrap;
}

.note-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.note-card {
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.note-main {
  flex: 1;
  min-width: 0;
}

.content {
  font-size: 14px;
  color: $text;
  line-height: 1.5;
  word-break: break-word;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.chip {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  background: $primary-light;
  color: $primary;
}

.date {
  font-size: 12px;
  color: $text-muted;
}

.delete {
  flex-shrink: 0;
  color: $text-muted;
  padding: 6px;
  border-radius: $radius-sm;
  transition: all 0.15s;

  &:hover {
    color: #ef4444;
    background: rgba(#ef4444, 0.1);
  }
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: $text-muted;
  font-size: 14px;
}
</style>
