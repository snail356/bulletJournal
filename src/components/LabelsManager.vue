<script setup lang="ts">
import { ref } from 'vue'
import ColorDotPicker from '@/components/ColorDotPicker.vue'
import AppIcon from '@/components/AppIcon.vue'
import DeleteIconButton from '@/components/DeleteIconButton.vue'
import { useTaskStore } from '@/stores/taskStore'
import { useSimpleReorderDrag } from '@/composables/useReorderDrag'
import { DEFAULT_LABEL_COLOR, LABEL_COLOR_OPTIONS } from '@/utils/labelColors'
import {
  COMPLETED_STATUS_ID,
  DEFAULT_STATUS_ID,
  STATUS_COLOR_OPTIONS,
} from '@/utils/status'
import type { StatusSortOnSelect } from '@/types'
import StatusSortIcons from '@/components/StatusSortIcons.vue'
import PopoverIconButton from '@/components/PopoverIconButton.vue'

const store = useTaskStore()
const newName = ref('')
const newColor = ref(DEFAULT_LABEL_COLOR)
const newStatusName = ref('')
const newStatusColor = ref(STATUS_COLOR_OPTIONS[0].value)
const newStatusSort = ref<StatusSortOnSelect>('none')
const editingLabelId = ref<string | null>(null)
const editingStatusId = ref<string | null>(null)

function focusOnMount(el: unknown) {
  if (el instanceof HTMLInputElement) {
    el.focus()
    el.select()
  }
}

function blurOnEnter(e: KeyboardEvent) {
  ;(e.target as HTMLInputElement).blur()
}

function saveLabelName(id: string, name: string) {
  editingLabelId.value = null
  const trimmed = name.trim()
  if (trimmed) store.updateLabel(id, { name: trimmed })
}

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
  (fromId, toId) => store.reorderStatusItems(fromId, toId),
)

function addLabel() {
  if (!newName.value.trim()) return
  store.createLabel(newName.value.trim(), newColor.value)
  newName.value = ''
}

function addStatus() {
  if (!newStatusName.value.trim()) return
  store.createStatusItem(newStatusName.value.trim(), newStatusColor.value, newStatusSort.value)
  newStatusName.value = ''
  newStatusSort.value = 'none'
  newStatusColor.value = nextStatusColor()
}

function saveStatusName(id: string, name: string) {
  editingStatusId.value = null
  const trimmed = name.trim()
  if (trimmed) store.updateStatusItem(id, { name: trimmed })
}

function updateStatusColor(id: string, color: string) {
  store.updateStatusItem(id, { color })
}

function statusDeleteMessage(id: string) {
  const remaining = store.statusItems.filter((item) => item.id !== id)
  const fallbackName =
    remaining.find((item) => item.id === DEFAULT_STATUS_ID)?.name ??
    remaining[0]?.name ??
    '其他狀態'
  return `確定刪除此狀態？使用中的任務將改為「${fallbackName}」。`
}

function nextStatusColor(): string {
  const used = new Set(store.statusItems.map((item) => item.color))
  const unused = STATUS_COLOR_OPTIONS.find((opt) => !used.has(opt.value))
  return unused?.value ?? STATUS_COLOR_OPTIONS[0].value
}

newStatusColor.value = nextStatusColor()
</script>

<template>
  <div class="labels-manager">
    <section class="section">
      <h2 class="section-title">任務標籤</h2>
      <p class="section-desc">管理任務標籤分類，拖曳可調整順序</p>

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
          <input
            v-if="editingLabelId === label.id"
            :ref="focusOnMount"
            class="name-input"
            type="text"
            :value="label.name"
            @blur="saveLabelName(label.id, ($event.target as HTMLInputElement).value)"
            @keyup.enter="blurOnEnter"
          />
          <template v-else>
            <span class="name">{{ label.name }}</span>
            <button
              type="button"
              class="edit"
              aria-label="編輯名稱"
              @click="editingLabelId = label.id"
            >
              <AppIcon name="pen" size="xs" />
            </button>
          </template>
          <DeleteIconButton
            title="刪除標籤"
            message="確定刪除此標籤？使用中的任務將移除此標籤。"
            @confirm="store.deleteLabel(label.id)"
          />
          <span class="count">
            {{ store.tasks.filter((t) => t.labels.includes(label.id)).length }} 項任務
          </span>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">狀態標籤</h2>
      <p class="section-desc">
        任務狀態可自由新增、刪除與重新命名。箭頭圖示可設定套用後將任務移至頂部或底部（已完成之上）。拖曳可調整選單順序。
      </p>

      <div class="add-form">
        <input
          v-model="newStatusName"
          type="text"
          placeholder="新狀態名稱"
          @keyup.enter="addStatus"
        />
        <ColorDotPicker v-model="newStatusColor" :options="STATUS_COLOR_OPTIONS" />
        <StatusSortIcons v-model="newStatusSort" />
        <button type="button" class="btn-primary" @click="addStatus">新增狀態</button>
      </div>

      <div class="label-grid status-grid">
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
            v-if="editingStatusId === item.id"
            :ref="focusOnMount"
            class="name-input"
            type="text"
            :value="item.name"
            @blur="saveStatusName(item.id, ($event.target as HTMLInputElement).value)"
            @keyup.enter="blurOnEnter"
          />
          <template v-else>
            <span class="name">{{ item.name }}</span>
            <button
              type="button"
              class="edit"
              aria-label="編輯名稱"
              @click="editingStatusId = item.id"
            >
              <AppIcon name="pen" size="xs" />
            </button>
          </template>
          <DeleteIconButton
            v-if="store.statusItems.length > 1"
            title="刪除狀態"
            :message="statusDeleteMessage(item.id)"
            @confirm="store.deleteStatusItem(item.id)"
          />
          <div class="status-meta">
            <span class="count">
              {{ store.getStatusTaskCount(item.id) }} 項任務
            </span>
            <StatusSortIcons
              v-if="item.id !== COMPLETED_STATUS_ID"
              :model-value="item.sortOnSelect"
              @update:model-value="(value) => store.updateStatusItem(item.id, { sortOnSelect: value })"
            />
            <PopoverIconButton
              v-else
              icon="check"
              label="標記為已完成，並移到清單底部"
              active
              disabled
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.section {
  margin-bottom: 32px;

  &:last-of-type {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.section-desc {
  color: $text-muted;
  font-size: 13px;
  margin-bottom: 16px;
}

.add-form {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  align-items: center;

  input[type='text'] {
    width: 180px;
    max-width: 100%;
    flex: none;
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

.count {
  width: 100%;
  font-size: 12px;
  color: $text-muted;
  padding-left: 22px;
}

.status-grid {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.status-meta {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-left: 22px;

  .count {
    width: auto;
    padding-left: 0;
    flex: 1;
  }
}

.edit {
  color: $text-muted;
  padding: 4px;
  border-radius: 4px;
  line-height: 1;

  &:hover {
    color: $primary;
    background: rgba(0, 0, 0, 0.05);
  }
}
</style>
