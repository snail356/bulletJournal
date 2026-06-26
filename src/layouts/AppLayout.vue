<script setup lang="ts">
import AppSidebar from '@/components/AppSidebar.vue'
</script>

<template>
  <div class="layout">
    <AppSidebar />
    <main class="main">
      <RouterView />
    </main>
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
