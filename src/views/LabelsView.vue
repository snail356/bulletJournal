<script setup lang="ts">
import { ref } from 'vue'
import { useTaskStore } from '@/stores/taskStore'

const store = useTaskStore()
const newName = ref('')
const newColor = ref('#7c3aed')

function addLabel() {
  if (!newName.value.trim()) return
  store.createLabel(newName.value.trim(), newColor.value)
  newName.value = ''
}

function removeLabel(id: string) {
  if (confirm('確定刪除此標籤？')) store.deleteLabel(id)
}
</script>

<template>
  <div class="labels-view">
    <header class="page-header">
      <h1>標籤管理</h1>
      <p class="subtitle">管理任務標籤分類</p>
    </header>

    <div class="add-form">
      <input v-model="newName" type="text" placeholder="新標籤名稱" />
      <input v-model="newColor" type="color" />
      <button type="button" class="btn-primary" @click="addLabel">新增標籤</button>
    </div>

    <div class="label-grid">
      <div v-for="label in store.labels" :key="label.id" class="label-card">
        <span class="dot" :style="{ background: label.color }" />
        <span class="name">{{ label.name }}</span>
        <span class="count">
          {{ store.tasks.filter((t) => t.labels.includes(label.id)).length }} 項任務
        </span>
        <button type="button" class="delete" @click="removeLabel(label.id)">刪除</button>
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

.add-form {
  display: flex;
  gap: 10px;
  margin-bottom: 24px;
  flex-wrap: wrap;

  input[type='text'] {
    flex: 1;
    min-width: 160px;
    padding: 10px 12px;
    border: 1px solid $border;
    border-radius: $radius-sm;
  }

  input[type='color'] {
    width: 44px;
    height: 40px;
    border: none;
    cursor: pointer;
  }
}

.btn-primary {
  padding: 10px 18px;
  background: $primary;
  color: white;
  border-radius: $radius-sm;
  font-weight: 600;
}

.label-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.label-card {
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow;
  padding: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.name {
  font-weight: 600;
  flex: 1;
}

.count {
  width: 100%;
  font-size: 12px;
  color: $text-muted;
}

.delete {
  font-size: 12px;
  color: #ef4444;

  &:hover {
    text-decoration: underline;
  }
}
</style>
