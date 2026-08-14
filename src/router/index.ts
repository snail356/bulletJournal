import { createRouter, createWebHistory } from 'vue-router'
import { useTaskStore } from '@/stores/taskStore'
import type { NavFeatureId } from '@/utils/navFeatures'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    navFeature?: NavFeatureId
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: () => useTaskStore().firstEnabledNavPath,
    },
    {
      path: '/today',
      name: 'today',
      component: () => import('@/views/TodayView.vue'),
      meta: { title: '今日任務', navFeature: 'today' },
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: () => import('@/views/CalendarView.vue'),
      meta: { title: '日曆', navFeature: 'calendar' },
    },
    {
      path: '/tasks',
      name: 'all-tasks',
      component: () => import('@/views/AllTasksView.vue'),
      meta: { title: '所有任務', navFeature: 'all-tasks' },
    },
    {
      path: '/tasks/:id',
      name: 'task-detail',
      component: () => import('@/views/TaskDetailView.vue'),
      meta: { title: '任務詳情' },
    },
    {
      path: '/labels',
      redirect: { path: '/settings', query: { tab: 'labels' } },
    },
    {
      path: '/difficulty-notes',
      name: 'difficulty-notes',
      component: () => import('@/views/DifficultyNotesView.vue'),
      meta: { title: '困難點資料', navFeature: 'difficulty-notes' },
    },
    {
      path: '/toolbox',
      name: 'toolbox',
      component: () => import('@/views/ToolboxView.vue'),
      meta: { title: '工具箱與思考清單', navFeature: 'toolbox' },
    },
    {
      path: '/reflections',
      name: 'reflections',
      component: () => import('@/views/ReflectionLogView.vue'),
      meta: { title: '回顧日誌', navFeature: 'reflections' },
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('@/views/StatsView.vue'),
      meta: { title: '統計分析', navFeature: 'stats' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: '設定', navFeature: 'settings' },
    },
  ],
})

router.beforeEach((to) => {
  const featureId = to.meta.navFeature
  if (!featureId) return true
  const store = useTaskStore()
  if (store.isNavFeatureEnabled(featureId)) return true
  return store.firstEnabledNavPath
})

router.afterEach((to) => {
  const title = (to.meta.title as string) ?? 'Bullet Journal'
  document.title = `${title} · Bullet Journal`
})

export default router
