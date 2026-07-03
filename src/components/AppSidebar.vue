<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import MiniCalendar from './MiniCalendar.vue'
import TodayProgress from './TodayProgress.vue'
import AppIcon from './AppIcon.vue'
import type { AppIconName } from '@/plugins/fontawesome'
import { useTaskStore } from '@/stores/taskStore'

const route = useRoute()
const store = useTaskStore()

const navItems: { path: string; label: string; icon: AppIconName }[] = [
  { path: '/today', label: '今日任務', icon: 'sun' },
  { path: '/tasks', label: '所有任務', icon: 'list-check' },
  { path: '/labels', label: '標籤管理', icon: 'tags' },
  { path: '/stats', label: '統計分析', icon: 'chart-column' },
  { path: '/settings', label: '設定', icon: 'gear' },
]

const progress = computed(() => store.todayProgress)

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}

function openMigrationReview() {
  store.openMigrationReview()
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <span class="brand-icon">
        <AppIcon name="book" size="lg" />
      </span>
      <div>
        <h1>Bullet Journal</h1>
        <p>工作狀態紀錄</p>
      </div>
    </div>

    <nav class="nav">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
      >
        <span class="nav-icon">
          <AppIcon :name="item.icon" />
        </span>
        {{ item.label }}
      </RouterLink>
      <button
        v-if="store.overdueTaskCount > 0"
        type="button"
        class="nav-item migration-btn"
        @click="openMigrationReview"
      >
        <span class="nav-icon">
          <AppIcon name="arrow-right" />
        </span>
        處理延期任務
        <span class="badge">{{ store.overdueTaskCount }}</span>
      </button>
    </nav>

    <div class="sidebar-widgets">
      <MiniCalendar />
      <TodayProgress
        :completed="progress.completed"
        :total="progress.total"
        :percentage="progress.percentage"
      />
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.sidebar {
  width: $sidebar-width;
  min-width: $sidebar-width;
  height: 100vh;
  background: $surface;
  border-right: 1px solid $border;
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  position: sticky;
  top: 0;
  overflow-y: auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
  padding: 0 8px;

  h1 {
    font-size: 16px;
    font-weight: 700;
    color: $primary;
  }

  p {
    font-size: 11px;
    color: $text-muted;
  }
}

.brand-icon {
  color: $primary;
  display: flex;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: $radius-sm;
  color: $text-muted;
  font-weight: 500;
  transition: all 0.15s;

  &:hover {
    background: $primary-light;
    color: $primary;
  }

  &.active {
    background: $primary-light;
    color: $primary;
    font-weight: 600;
  }
}

.migration-btn {
  width: 100%;
  text-align: left;
  border: 1px dashed rgba($primary, 0.35);
  margin-top: 4px;

  &:hover {
    border-color: $primary;
  }
}

.badge {
  margin-left: auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: $primary;
  color: white;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon {
  width: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-widgets {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 20px;
  flex-shrink: 0;
}
</style>
