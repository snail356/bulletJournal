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
  padding: 32px 40px;
  overflow-y: auto;
  min-height: 100vh;
}
</style>
