<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { TaskStatus } from '@/types'
import { useTaskStore } from '@/stores/taskStore'
import { ALL_STATUSES, STATUS_BG, STATUS_COLORS, STATUS_LABELS } from '@/utils/status'

const store = useTaskStore()
const router = useRouter()
const filter = ref<TaskStatus | 'all'>('all')

const tasks = computed(() => store.getAllTasksFiltered(filter.value))

function goDetail(id: string) {
  router.push(`/tasks/${id}`)
}
</script>

<template>
  <div class="all-tasks-view">
    <header class="page-header">
      <h1>所有任務</h1>
      <p class="subtitle">共 {{ store.tasks.length }} 項任務</p>
    </header>

    <div class="filters">
      <button
        type="button"
        class="filter-chip"
        :class="{ active: filter === 'all' }"
        @click="filter = 'all'"
      >
        全部
      </button>
      <button
        v-for="status in ALL_STATUSES"
        :key="status"
        type="button"
        class="filter-chip"
        :class="{ active: filter === status }"
        :style="{
          '--c': STATUS_COLORS[status],
          '--bg': STATUS_BG[status],
        }"
        @click="filter = status"
      >
        {{ STATUS_LABELS[status] }}
      </button>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>標題</th>
            <th>日期</th>
            <th>狀態</th>
            <th>子任務</th>
            <th>完成</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="task in tasks"
            :key="task.id"
            class="row"
            @click="goDetail(task.id)"
          >
            <td class="title">{{ task.title }}</td>
            <td>{{ task.date }}</td>
            <td>
              <span
                class="status-tag"
                :style="{
                  color: STATUS_COLORS[task.status],
                  background: STATUS_BG[task.status],
                }"
              >
                {{ STATUS_LABELS[task.status] }}
              </span>
            </td>
            <td>{{ task.subtasks.length }}</td>
            <td>{{ task.completed ? '✓' : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!tasks.length" class="empty">沒有符合條件的任務</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.page-header {
  margin-bottom: 20px;

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

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.filter-chip {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  background: $surface;
  border: 1px solid $border;
  color: $text-muted;

  &.active {
    background: var(--bg, $primary-light);
    color: var(--c, $primary);
    border-color: var(--c, $primary);
    font-weight: 600;
  }

  &:hover:not(.active) {
    border-color: $primary;
    color: $primary;
  }
}

.table-wrap {
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow;
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  color: $text-muted;
  font-weight: 600;
  background: $bg;
  border-bottom: 1px solid $border;
}

td {
  padding: 12px 16px;
  border-bottom: 1px solid $border;
  font-size: 13px;
}

.row {
  cursor: pointer;

  &:hover {
    background: $bg;
  }

  .title {
    font-weight: 500;
  }
}

.status-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
}

.empty {
  padding: 40px;
  text-align: center;
  color: $text-muted;
}
</style>
