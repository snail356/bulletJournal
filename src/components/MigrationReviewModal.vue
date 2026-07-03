<script setup lang="ts">
import { ref, watch } from 'vue'
import type { MigrationCandidate, MigrationReviewAction, MigrationReviewActionType } from '@/types'
import { formatDisplayDate, todayString } from '@/utils/date'

const props = defineProps<{
  visible: boolean
  candidates: MigrationCandidate[]
}>()

const emit = defineEmits<{
  confirm: [actions: MigrationReviewAction[]]
  snooze: []
  close: []
}>()

const rowActions = ref<Record<string, MigrationReviewActionType>>({})

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    const next: Record<string, MigrationReviewActionType> = {}
    for (const candidate of props.candidates) {
      next[candidate.task.id] = 'migrate'
    }
    rowActions.value = next
  },
)

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function setAllMigrate() {
  for (const candidate of props.candidates) {
    rowActions.value[candidate.task.id] = 'migrate'
  }
  confirm()
}

function confirm() {
  const actions: MigrationReviewAction[] = props.candidates.map((candidate) => ({
    taskId: candidate.task.id,
    action: rowActions.value[candidate.task.id] ?? 'migrate',
    targetDate: todayString(),
  }))
  emit('confirm', actions)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay" @click.self="emit('snooze')">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="migration-review-title">
        <header class="header">
          <h2 id="migration-review-title">每日回顧 · {{ formatDisplayDate(todayString()) }}</h2>
          <p class="subtitle">
            你有 {{ candidates.length }} 項未完成的延期任務，請決定如何處理
          </p>
        </header>

        <ul class="list">
          <li v-for="candidate in candidates" :key="candidate.task.id" class="row">
            <div class="task-info">
              <p class="task-title">{{ candidate.task.title }}</p>
              <p class="task-meta">
                原排程 {{ formatShortDate(candidate.overdueFrom) }}
                <span v-if="candidate.daysOverdue > 1" class="overdue">
                  · 逾期 {{ candidate.daysOverdue }} 天
                </span>
              </p>
            </div>
            <select
              v-model="rowActions[candidate.task.id]"
              class="action-select"
              :aria-label="`處理 ${candidate.task.title}`"
            >
              <option value="migrate">遷移到今天</option>
              <option value="keep">保留在原日</option>
              <option value="complete">標記完成</option>
            </select>
          </li>
        </ul>

        <div class="actions">
          <button type="button" class="btn-text" @click="emit('snooze')">稍後再說</button>
          <button type="button" class="btn-secondary" @click="setAllMigrate">全部遷移到今天</button>
          <button type="button" class="btn-primary" @click="confirm">確認</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.overlay {
  position: fixed;
  inset: 0;
  z-index: 1600;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal {
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow-lg;
  width: 100%;
  max-width: 520px;
  max-height: min(80vh, 640px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  padding: 24px 24px 12px;

  h2 {
    font-size: 18px;
    font-weight: 700;
  }
}

.subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: $text-muted;
  line-height: 1.5;
}

.list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $bg;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.task-meta {
  margin-top: 4px;
  font-size: 12px;
  color: $text-muted;
}

.overdue {
  color: #d97706;
}

.action-select {
  flex-shrink: 0;
  padding: 6px 8px;
  font-size: 12px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $surface;
  color: $text;
  max-width: 130px;

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 3px $primary-light;
  }
}

.actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 16px 24px 24px;
  border-top: 1px solid $border;
}

.btn-text {
  margin-right: auto;
  padding: 8px 12px;
  font-size: 13px;
  color: $text-muted;
  border-radius: $radius-sm;

  &:hover {
    background: $bg;
    color: $text;
  }
}

.btn-primary {
  padding: 8px 18px;
  background: $primary;
  color: white;
  border-radius: $radius-sm;
  font-weight: 600;

  &:hover {
    background: $primary-dark;
  }
}

.btn-secondary {
  padding: 8px 14px;
  color: $primary;
  border: 1px solid $primary;
  border-radius: $radius-sm;
  font-weight: 600;
  font-size: 13px;

  &:hover {
    background: $primary-light;
  }
}
</style>
