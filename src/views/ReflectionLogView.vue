<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useTaskStore } from '@/stores/taskStore'
import { formatDisplayDate } from '@/utils/date'
import type { DailyReflection } from '@/types'

const store = useTaskStore()
const selectedDate = ref<string | null>(null)
const confirmVisible = ref(false)
const pendingDelete = ref<DailyReflection | null>(null)

const reflections = computed(() => store.dailyReflectionsSorted)

const selected = computed(() => {
  if (!selectedDate.value) return null
  return store.getReflectionByDate(selectedDate.value) ?? null
})

watch(
  reflections,
  (list) => {
    if (!list.length) {
      selectedDate.value = null
      return
    }
    if (!selectedDate.value || !list.some((item) => item.date === selectedDate.value)) {
      selectedDate.value = list[0].date
    }
  },
  { immediate: true },
)

function selectDate(date: string) {
  selectedDate.value = date
}

function previewText(reflection: DailyReflection): string {
  const parts = [
    reflection.morningContent,
    reflection.afternoon1to3Content,
    reflection.afternoonAfter3Content,
  ]
    .map((text) => text.trim())
    .filter(Boolean)
  if (!parts.length) return '（尚未填寫內容）'
  const joined = parts.join(' · ')
  return joined.length > 60 ? `${joined.slice(0, 60)}…` : joined
}

function displayContent(text: string): string {
  const trimmed = text.trim()
  return trimmed || '（未填寫）'
}

function requestDelete(reflection: DailyReflection) {
  pendingDelete.value = reflection
  confirmVisible.value = true
}

function confirmDelete() {
  if (!pendingDelete.value) return
  store.deleteDailyReflection(pendingDelete.value.id)
  pendingDelete.value = null
}
</script>

<template>
  <div class="reflection-view">
    <header class="page-header">
      <h1>回顧日誌</h1>
      <p class="subtitle">依日期瀏覽每日回顧；三個時段會整合顯示為一份完整紀錄</p>
    </header>

    <div v-if="reflections.length" class="layout">
      <aside class="timeline" aria-label="回顧日期列表">
        <button
          v-for="item in reflections"
          :key="item.id"
          type="button"
          class="date-item"
          :class="{ active: item.date === selectedDate }"
          @click="selectDate(item.date)"
        >
          <span class="date-label">{{ formatDisplayDate(item.date) }}</span>
          <span class="date-preview">{{ previewText(item) }}</span>
        </button>
      </aside>

      <section v-if="selected" class="detail">
        <div class="detail-header">
          <div>
            <h2>{{ formatDisplayDate(selected.date) }}</h2>
            <p class="detail-meta">完整回顧報告</p>
          </div>
          <button
            type="button"
            class="delete"
            aria-label="刪除此日回顧"
            @click="requestDelete(selected)"
          >
            <AppIcon name="trash" size="sm" />
          </button>
        </div>

        <article class="report">
          <section class="block">
            <h3 class="hint">早上</h3>
            <p class="body">{{ displayContent(selected.morningContent) }}</p>
          </section>
          <section class="block">
            <h3 class="hint">下午1點-3點</h3>
            <p class="body">{{ displayContent(selected.afternoon1to3Content) }}</p>
          </section>
          <section class="block">
            <h3 class="hint">下午3點後</h3>
            <p class="body">{{ displayContent(selected.afternoonAfter3Content) }}</p>
          </section>
        </article>
      </section>
    </div>

    <div v-else class="empty">
      <p>尚無回顧紀錄。於今日任務頁新增日誌並完成提交後，會顯示在此。</p>
    </div>

    <ConfirmDialog
      :visible="confirmVisible"
      title="刪除回顧"
      message="確定刪除這一天的回顧日誌？此操作無法復原。"
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

.layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) 1fr;
  gap: 20px;
  align-items: start;
  min-height: 420px;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 180px);
  overflow-y: auto;
  padding-right: 4px;
}

.date-item {
  text-align: left;
  padding: 12px 14px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $surface;
  transition: all 0.15s;

  &:hover {
    border-color: $primary;
    background: $primary-light;
  }

  &.active {
    border-color: $primary;
    background: $primary-light;
    box-shadow: 0 0 0 2px rgba($primary, 0.15);
  }
}

.date-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: $text;
}

.date-preview {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: $text-muted;
  line-height: 1.4;
}

.detail {
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow;
  padding: 24px;
  min-height: 360px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid $border;

  h2 {
    font-size: 20px;
    font-weight: 700;
  }
}

.detail-meta {
  margin-top: 4px;
  font-size: 13px;
  color: $text-muted;
}

.delete {
  flex-shrink: 0;
  color: $text-muted;
  padding: 6px;
  border-radius: $radius-sm;

  &:hover {
    color: #ef4444;
    background: rgba(#ef4444, 0.1);
  }
}

.report {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hint {
  color: #888888;
  font-size: 0.85rem;
  font-weight: 500;
}

.body {
  font-size: 14px;
  line-height: 1.7;
  color: $text;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: $text-muted;
  font-size: 14px;
}

@media (max-width: $breakpoint-md) {
  .layout {
    grid-template-columns: 1fr;
  }

  .timeline {
    max-height: none;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 4px;
  }

  .date-item {
    min-width: 180px;
    flex-shrink: 0;
  }

  .detail {
    padding: 18px;
  }
}
</style>
