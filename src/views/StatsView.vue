<script setup lang="ts">
import { computed } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import { ALL_STATUSES, STATUS_COLORS, STATUS_LABELS } from '@/utils/status'

const store = useTaskStore()
const stats = computed(() => store.getTaskStats())

const maxStatusCount = computed(() =>
  Math.max(...Object.values(stats.value.byStatus), 1),
)

function barWidth(count: number) {
  return `${(count / maxStatusCount.value) * 100}%`
}
</script>

<template>
  <div class="stats-view">
    <header class="page-header">
      <h1>統計分析</h1>
      <p class="subtitle">任務完成與狀態分佈</p>
    </header>

    <div class="cards">
      <div class="stat-card">
        <span class="value">{{ stats.total }}</span>
        <span class="label">總任務數</span>
      </div>
      <div class="stat-card">
        <span class="value">{{ stats.completed }}</span>
        <span class="label">已完成</span>
      </div>
      <div class="stat-card">
        <span class="value">
          {{ stats.total ? Math.round((stats.completed / stats.total) * 100) : 0 }}%
        </span>
        <span class="label">完成率</span>
      </div>
    </div>

    <div class="chart-card">
      <h2>狀態分佈</h2>
      <div class="bars">
        <div v-for="status in ALL_STATUSES" :key="status" class="bar-row">
          <span class="bar-label">{{ STATUS_LABELS[status] }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{
                width: barWidth(stats.byStatus[status] ?? 0),
                background: STATUS_COLORS[status],
              }"
            />
          </div>
          <span class="bar-count">{{ stats.byStatus[status] ?? 0 }}</span>
        </div>
      </div>
    </div>
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

.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow;
  padding: 24px;
  text-align: center;

  .value {
    display: block;
    font-size: 32px;
    font-weight: 700;
    color: $primary;
  }

  .label {
    font-size: 13px;
    color: $text-muted;
    margin-top: 4px;
  }
}

.chart-card {
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow;
  padding: 24px;

  h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 20px;
  }
}

.bar-row {
  display: grid;
  grid-template-columns: 100px 1fr 32px;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.bar-label {
  font-size: 12px;
  color: $text-muted;
}

.bar-track {
  height: 10px;
  background: $bg;
  border-radius: 5px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.4s ease;
  min-width: 2px;
}

.bar-count {
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}
</style>
