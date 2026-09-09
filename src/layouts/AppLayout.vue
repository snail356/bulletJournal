<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import FloatingSphere from '@/components/FloatingSphere.vue'
import MigrationReviewModal from '@/components/MigrationReviewModal.vue'
import ReflectionModal from '@/components/ReflectionModal.vue'
import { useStockStore } from '@/stores/stockStore'
import { useTaskStore } from '@/stores/taskStore'
import { todayString } from '@/utils/date'
import { maybeRunAutoBackup } from '@/utils/runBackup'
import type { DailyReflectionInput, MigrationReviewAction } from '@/types'

const store = useTaskStore()
const stockStore = useStockStore()
const router = useRouter()
const autoBackupToast = ref('')
let autoBackupToastTimer: ReturnType<typeof setTimeout> | null = null

function showAutoBackupToast() {
  autoBackupToast.value = '已完成自動備份'
  if (autoBackupToastTimer) clearTimeout(autoBackupToastTimer)
  autoBackupToastTimer = setTimeout(() => {
    autoBackupToast.value = ''
    autoBackupToastTimer = null
  }, 4000)
}

function checkAutoBackup() {
  void maybeRunAutoBackup()
    .then((ran) => {
      if (ran) showAutoBackupToast()
    })
    .catch(() => {
      // 背景自動備份失敗時下次再開啟再試
    })
}

function flushPersistedData() {
  void Promise.all([store.flushAppData(), stockStore.flushFavorites()])
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    store.checkDailyPrompts()
    checkAutoBackup()
    return
  }
  flushPersistedData()
}

function onPageHide() {
  flushPersistedData()
}

function onMigrationReviewConfirm(actions: MigrationReviewAction[]) {
  store.applyMigrationReview(actions)
  store.setSelectedDate(todayString())
  if (
    store.isNavFeatureEnabled('today') &&
    router.currentRoute.value.path !== '/today'
  ) {
    router.push('/today')
  }
}

function onReflectionSubmit(input: DailyReflectionInput) {
  store.submitDailyReflection(input)
  if (
    store.isNavFeatureEnabled('reflections') &&
    router.currentRoute.value.path !== '/reflections'
  ) {
    router.push('/reflections')
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
  checkAutoBackup()
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('pagehide', onPageHide)
  if (autoBackupToastTimer) clearTimeout(autoBackupToastTimer)
})
</script>

<template>
  <div class="layout">
    <AppSidebar />
    <main class="main">
      <RouterView />
    </main>

    <FloatingSphere />

    <MigrationReviewModal
      :visible="store.migrationReviewVisible"
      :candidates="store.migrationCandidates"
      @confirm="onMigrationReviewConfirm"
      @snooze="store.snoozeMigrationReview"
      @close="store.snoozeMigrationReview"
    />

    <ReflectionModal
      :visible="store.isNavFeatureEnabled('reflections') && store.reflectionModalVisible"
      :date="store.reflectionModalDate"
      :mode="store.reflectionModalMode"
      :existing="store.getReflectionByDate(store.reflectionModalDate)"
      @submit="onReflectionSubmit"
      @save="store.saveDailyReflectionDraft"
      @cancel="store.dismissReflectionModal"
    />

    <Teleport to="body">
      <Transition name="backup-toast">
        <div v-if="autoBackupToast" class="backup-toast">{{ autoBackupToast }}</div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 32px 40px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.backup-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3000;
  background: #1f2937;
  color: white;
  padding: 12px 16px;
  border-radius: $radius-sm;
  box-shadow: $shadow-lg;
  font-size: 13px;
}

.backup-toast-enter-active,
.backup-toast-leave-active {
  transition: all 0.25s ease;
}

.backup-toast-enter-from,
.backup-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}

@media (max-width: $breakpoint-md) {
  .layout {
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .main {
    order: 2;
    flex: 0 0 auto;
    min-height: auto;
    overflow: visible;
    padding: 20px 16px;
  }
}

@media (max-width: $breakpoint-xs) {
  .main {
    padding: 16px 12px;
  }
}
</style>
