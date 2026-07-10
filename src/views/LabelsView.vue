<script setup lang="ts">
import { ref } from 'vue'
import type { TaskStatus } from '@/types'
import ColorDotPicker from '@/components/ColorDotPicker.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useTaskStore } from '@/stores/taskStore'
import { useSimpleReorderDrag } from '@/composables/useReorderDrag'
import { DEFAULT_LABEL_COLOR, LABEL_COLOR_OPTIONS } from '@/utils/labelColors'
import { STATUS_COLOR_OPTIONS } from '@/utils/status'

const store = useTaskStore()
const newName = ref('')
const newColor = ref(DEFAULT_LABEL_COLOR)
const confirmVisible = ref(false)
const pendingDeleteId = ref<string | null>(null)

const { draggingId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd } =
  useSimpleReorderDrag(
    () => store.labels,
    (fromId, toId) => store.reorderLabels(fromId, toId),
  )

const {
  draggingId: statusDraggingId,
  dragOverId: statusDragOverId,
  onDragStart: onStatusDragStart,
  onDragOver: onStatusDragOver,
  onDrop: onStatusDrop,
  onDragEnd: onStatusDragEnd,
} = useSimpleReorderDrag(
  () => store.statusItems,
  (fromId, toId) => store.reorderStatusItems(fromId as TaskStatus, toId as TaskStatus),
)

function addLabel() {
  if (!newName.value.trim()) return
  store.createLabel(newName.value.trim(), newColor.value)
  newName.value = ''
}

function removeLabel(id: string) {
  pendingDeleteId.value = id
  confirmVisible.value = true
}

function confirmRemoveLabel() {
  if (pendingDeleteId.value) {
    store.deleteLabel(pendingDeleteId.value)
    pendingDeleteId.value = null
  }
}

function updateStatusName(id: TaskStatus, name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  store.updateStatusItem(id, { name: trimmed })
}

function updateStatusColor(id: TaskStatus, color: string) {
  store.updateStatusItem(id, { color })
}
</script>

<template>
  <div class="labels-view">
    <header class="page-header">
      <h1>標籤管理</h1>
      <p class="subtitle">管理任務標籤分類，拖曳可調整順序</p>
    </header>

    <section class="section">
      <h2 class="section-title">任務標籤</h2>

      <div class="add-form">
        <input v-model="newName" type="text" placeholder="新標籤名稱" @keyup.enter="addLabel" />
        <ColorDotPicker v-model="newColor" :options="LABEL_COLOR_OPTIONS" />
        <button type="button" class="btn-primary" @click="addLabel">新增標籤</button>
      </div>

      <div class="label-grid">
        <div
          v-for="label in store.labels"
          :key="label.id"
          class="label-card"
          :class="{
            dragging: draggingId === label.id,
            'drag-over': dragOverId === label.id,
          }"
          @dragover="onDragOver($event, label.id)"
          @drop="onDrop($event, label.id)"
        >
          <span
            class="drag-handle"
            draggable="true"
            aria-label="拖曳排序"
            @dragstart="onDragStart($event, label.id)"
            @dragend="onDragEnd"
          >
            <AppIcon name="grip-vertical" />
          </span>
          <ColorDotPicker
            :model-value="label.color"
            :options="LABEL_COLOR_OPTIONS"
            @update:model-value="(color) => store.updateLabel(label.id, { color })"
          />
          <span class="name">{{ label.name }}</span>
          <span class="count">
            {{ store.tasks.filter((t) => t.labels.includes(label.id)).length }} 項任務
          </span>
          <button type="button" class="delete" @click="removeLabel(label.id)">刪除</button>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">狀態標籤</h2>
      <p class="section-desc">任務狀態下拉選單的選項與顏色，拖曳可調整順序</p>

      <div class="label-grid">
        <div
          v-for="item in store.statusItems"
          :key="item.id"
          class="label-card status-card"
          :class="{
            dragging: statusDraggingId === item.id,
            'drag-over': statusDragOverId === item.id,
          }"
          @dragover="onStatusDragOver($event, item.id)"
          @drop="onStatusDrop($event, item.id)"
        >
          <span
            class="drag-handle"
            draggable="true"
            aria-label="拖曳排序"
            @dragstart="onStatusDragStart($event, item.id)"
            @dragend="onStatusDragEnd"
          >
            <AppIcon name="grip-vertical" />
          </span>
          <ColorDotPicker
            :model-value="item.color"
            :options="STATUS_COLOR_OPTIONS"
            @update:model-value="(color) => updateStatusColor(item.id, color)"
          />
          <input
            class="name-input"
            type="text"
            :value="item.name"
            @change="updateStatusName(item.id, ($event.target as HTMLInputElement).value)"
          />
          <span
            class="status-preview"
            :style="{ color: item.color, background: item.bgColor }"
          >
            {{ item.name }}
          </span>
          <span class="count">
            {{ store.getStatusTaskCount(item.id) }} 項任務
          </span>
        </div>
      </div>
    </section>

    <ConfirmDialog
      :visible="confirmVisible"
      title="刪除標籤"
      message="確定刪除此標籤？使用中的任務將移除此標籤。"
      confirm-label="確定"
      cancel-label="取消"
      danger
      @confirm="confirmRemoveLabel"
      @close="confirmVisible = false"
    />
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

.section {
  margin-bottom: 40px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 12px;
}

.section-desc {
  color: $text-muted;
  font-size: 13px;
  margin: -4px 0 16px;
}

.add-form {
  display: flex;
  gap: 10px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  align-items: center;

  input[type='text'] {
    flex: 1;
    min-width: 160px;
    padding: 10px 12px;
    border: 1px solid $border;
    border-radius: $radius-sm;
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
  transition: box-shadow 0.15s, opacity 0.15s;
  position: relative;

  &.dragging {
    opacity: 0.45;
  }

  &.drag-over {
    box-shadow: $shadow, inset 0 -2px 0 $primary;
  }
}

.drag-handle {
  color: $text-muted;
  font-size: 14px;
  cursor: grab;
  opacity: 0.4;
  line-height: 1;

  &:hover {
    opacity: 0.8;
  }

  &:active {
    cursor: grabbing;
  }
}

.name {
  font-weight: 600;
  flex: 1;
}

.name-input {
  flex: 1;
  min-width: 100px;
  padding: 4px 6px;
  border: 1px solid $border;
  border-radius: 4px;
  font-weight: 600;
  font-size: 14px;
}

.status-preview {
  width: 100%;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  display: inline-block;
  width: fit-content;
  margin-left: 22px;
}

.count {
  width: 100%;
  font-size: 12px;
  color: $text-muted;
  padding-left: 22px;
}

.delete {
  font-size: 12px;
  color: #ef4444;

  &:hover {
    text-decoration: underline;
  }
}
</style>
