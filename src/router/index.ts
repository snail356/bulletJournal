import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/today',
    },
    {
      path: '/today',
      name: 'today',
      component: () => import('@/views/TodayView.vue'),
      meta: { title: '今日任務' },
    },
    {
      path: '/tasks',
      name: 'all-tasks',
      component: () => import('@/views/AllTasksView.vue'),
      meta: { title: '所有任務' },
    },
    {
      path: '/tasks/:id',
      name: 'task-detail',
      component: () => import('@/views/TaskDetailView.vue'),
      meta: { title: '任務詳情' },
    },
    {
      path: '/labels',
      name: 'labels',
      component: () => import('@/views/LabelsView.vue'),
      meta: { title: '標籤管理' },
    },
    {
      path: '/difficulty-notes',
      name: 'difficulty-notes',
      component: () => import('@/views/DifficultyNotesView.vue'),
      meta: { title: '困難點資料' },
    },
    {
      path: '/reflections',
      name: 'reflections',
      component: () => import('@/views/ReflectionLogView.vue'),
      meta: { title: '回顧日誌' },
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('@/views/StatsView.vue'),
      meta: { title: '統計分析' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: '設定' },
    },
  ],
})

router.afterEach((to) => {
  const title = (to.meta.title as string) ?? 'Bullet Journal'
  document.title = `${title} · Bullet Journal`
})

export default router
