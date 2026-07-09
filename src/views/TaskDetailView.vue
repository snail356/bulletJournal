<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Attachment, Task } from '@/types'
import TaskCard from '@/components/TaskCard.vue'
import AttachmentPreview from '@/components/AttachmentPreview.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useTaskStore } from '@/stores/taskStore'

const route = useRoute()
const router = useRouter()
const store = useTaskStore()
const previewAttachment = ref<Attachment | null>(null)

const task = computed(() => store.findTask(route.params.id as string))

function onDeleted(task: Task) {
  store.deleteTask(task.id)
  router.push('/tasks')
}
</script>

<template>
  <div class="detail-view">
    <button type="button" class="back" @click="router.back()">
      <AppIcon name="arrow-left" size="xs" />
      返回
    </button>

    <template v-if="task">
      <header class="page-header">
        <h1>任務詳情</h1>
        <p class="subtitle">建立於 {{ new Date(task.createdAt).toLocaleString('zh-TW') }}</p>
      </header>
      <TaskCard
        :task="task"
        @preview="previewAttachment = $event"
        @deleted="onDeleted"
      />
    </template>

    <div v-else class="not-found">
      <p>找不到此任務</p>
      <button type="button" @click="router.push('/tasks')">回到任務列表</button>
    </div>

    <AttachmentPreview
      :attachment="previewAttachment"
      @close="previewAttachment = null"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: $text-muted;
  font-size: 13px;
  margin-bottom: 16px;

  &:hover {
    color: $primary;
  }
}

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

.not-found {
  text-align: center;
  padding: 60px;
  color: $text-muted;

  button {
    margin-top: 12px;
    color: $primary;
    font-weight: 600;
  }
}
</style>
