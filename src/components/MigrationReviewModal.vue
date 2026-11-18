<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MigrationReviewAction, MigrationReviewActionType, MigrationCandidate } from '@/types'
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

const current = computed(() => props.candidates[0] ?? null)
const action = ref<MigrationReviewActionType>('migrate')

watch(
  () => (props.visible ? current.value?.task.id ?? null : null),
  () => {
    action.value = 'migrate'
  },
)

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function confirmCurrent() {
  const candidate = current.value
  if (!candidate) return
  emit('confirm', [
    {
      taskId: candidate.task.id,
      action: action.value,
      targetDate: todayString(),
    },
  ])
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible && current" class="overlay" @click.self="emit('snooze')">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="migration-review-title">
        <header class="header">
          <h2 id="migration-review-title">延期任務處理 · {{ formatDisplayDate(todayString()) }}</h2>
          <p class="subtitle">尚餘 {{ candidates.length }} 項，一次只處理一項</p>
        </header>

        <div class="card" aria-live="polite">
          <p class="task-title">{{ current.task.title }}</p>
          <p class="task-meta">
            原排程 {{ formatShortDate(current.overdueFrom) }}
            <span v-if="current.daysOverdue > 1" class="overdue">
              · 逾期 {{ current.daysOverdue }} 天
            </span>
          </p>
          <label class="field">
            <span class="hint">處理方式</span>
            <select
              v-model="action"
              class="action-select"
              :aria-label="`處理 ${current.task.title}`"
            >
              <option value="migrate">遷移到今天</option>
              <option value="keep">保留在原日</option>
              <option value="complete">標記完成</option>
            </select>
          </label>
        </div>

        <div class="actions">
          <button type="button" class="btn-text" @click="emit('snooze')">稍後再說</button>
          <button type="button" class="btn-primary" @click="confirmCurrent">確認</button>
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
  background: $overlay;
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
  max-width: 420px;
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

.card {
  margin: 8px 24px 0;
  padding: 16px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $bg;
}

.task-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.45;
}

.task-meta {
  margin-top: 6px;
  font-size: 13px;
  color: $text-muted;
}

.overdue {
  color: #d97706;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 16px;
}

.hint {
  font-size: 12px;
  color: $text-muted;
}

.action-select {
  width: 100%;
  padding: 8px 10px;
  font-size: 14px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $surface;
  color: $text;

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

@media (max-width: $breakpoint-sm) {
  .overlay {
    padding: 12px;
    align-items: flex-end;
  }

  .modal {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .card {
    margin: 8px 16px 0;
  }

  .actions {
    padding: 12px 16px 16px;
  }
}
</style>
