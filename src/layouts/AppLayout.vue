<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import FloatingSphere from '@/components/FloatingSphere.vue'
import MigrationReviewModal from '@/components/MigrationReviewModal.vue'
import ReflectionModal from '@/components/ReflectionModal.vue'
import { useTaskStore } from '@/stores/taskStore'
import type { DailyReflectionInput } from '@/types'

const store = useTaskStore()
const router = useRouter()

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    store.checkDailyPrompts()
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
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
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
      @confirm="store.applyMigrationReview"
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
