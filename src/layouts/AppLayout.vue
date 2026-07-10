<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppSidebar from '@/components/AppSidebar.vue'
import MigrationReviewModal from '@/components/MigrationReviewModal.vue'
import { useTaskStore } from '@/stores/taskStore'

const store = useTaskStore()

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    store.checkMigrationReview()
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

    <MigrationReviewModal
      :visible="store.migrationReviewVisible"
      :candidates="store.migrationCandidates"
      @confirm="store.applyMigrationReview"
      @snooze="store.snoozeMigrationReview"
      @close="store.snoozeMigrationReview"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.layout {
  display: flex;
  min-height: 100vh;
}

.main {
  flex: 1;
  min-width: 0;
  padding: 32px 40px;
  overflow-y: auto;
  min-height: 100vh;
}

@media (max-width: $breakpoint-md) {
  .layout {
    flex-direction: column;
  }

  .main {
    padding: 20px 16px;
    min-height: auto;
  }
}

@media (max-width: $breakpoint-xs) {
  .main {
    padding: 16px 12px;
  }
}
</style>
