<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Task } from '@/types'
import { useTaskStore } from '@/stores/taskStore'
import { getTaskDuration, normalizeEndDate } from '@/utils/date'
import TaskAvatarFace from '@/components/TaskAvatarFace.vue'

const props = defineProps<{
  visible: boolean
  task?: Task | null
  mode: 'create' | 'edit'
  defaultDate?: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const store = useTaskStore()
const title = ref('')
const date = ref('')
const endDate = ref('')
const selectedLabels = ref<string[]>([])
const avatarId = ref<string | null>(null)

const duration = computed(() => {
  const end = endDate.value || date.value
  if (!date.value) return 1
  return getTaskDuration({ date: date.value, endDate: end || null })
})

watch(
  () => props.visible,
  (v) => {
    if (!v) return
    if (props.mode === 'edit' && props.task) {
      title.value = props.task.title
      date.value = props.task.date
      endDate.value = props.task.endDate ?? ''
      selectedLabels.value = [...props.task.labels]
      avatarId.value = props.task.avatarId
    } else {
      title.value = ''
      date.value = props.defaultDate ?? store.selectedDate
      endDate.value = ''
      selectedLabels.value = []
      avatarId.value = null
    }
  },
  { immediate: true },
)

watch(date, (start) => {
  if (endDate.value && endDate.value < start) endDate.value = ''
})

function toggleLabel(id: string) {
  const idx = selectedLabels.value.indexOf(id)
  if (idx >= 0) selectedLabels.value.splice(idx, 1)
  else selectedLabels.value.push(id)
}

function save() {
  if (!title.value.trim()) return
  if (props.mode === 'edit' && props.task) {
    store.updateTask(props.task.id, {
      title: title.value.trim(),
      date: date.value,
      endDate: normalizeEndDate(date.value, endDate.value || null),
      labels: [...selectedLabels.value],
      avatarId: avatarId.value,
    })
  } else {
    store.createTask({
      title: title.value.trim(),
      date: date.value,
      endDate: normalizeEndDate(date.value, endDate.value || null),
      labels: [...selectedLabels.value],
      avatarId: avatarId.value,
    })
  }
  emit('saved')
  emit('close')
}

const backdropPointerDown = ref(false)

function onOverlayPointerDown(e: PointerEvent) {
  backdropPointerDown.value = e.target === e.currentTarget
}

function onOverlayPointerUp(e: PointerEvent) {
  if (backdropPointerDown.value && e.target === e.currentTarget) {
    emit('close')
  }
}

function resetBackdropPointerDown() {
  backdropPointerDown.value = false
}

onMounted(() => document.addEventListener('pointerup', resetBackdropPointerDown))
onUnmounted(() => document.removeEventListener('pointerup', resetBackdropPointerDown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="overlay"
      @pointerdown.self="onOverlayPointerDown"
      @pointerup.self="onOverlayPointerUp"
    >
      <div class="modal">
        <h2>{{ mode === 'create' ? '新增任務' : '編輯任務' }}</h2>
        <label>
          任務標題
          <input v-model="title" type="text" placeholder="輸入任務標題..." @keyup.enter="save" />
        </label>
        <div class="date-row">
          <label>
            開始日期
            <input v-model="date" type="date" />
          </label>
          <label>
            結束日期
            <input v-model="endDate" type="date" :min="date" />
          </label>
        </div>
        <p class="duration-hint">
          {{ endDate ? `共 ${duration} 天` : '未設定結束日期時為單日任務' }}
        </p>
        <div class="field">
          <span class="field-label">任務頭像</span>
          <div class="avatar-row">
            <button
              type="button"
              class="avatar-chip"
              :class="{ active: avatarId === null }"
              @click="avatarId = null"
            >
              無
            </button>
            <button
              v-for="avatar in store.taskAvatars"
              :key="avatar.id"
              type="button"
              class="avatar-chip"
              :class="{ active: avatarId === avatar.id }"
              @click="avatarId = avatar.id"
            >
              <TaskAvatarFace :avatar="avatar" size="sm" />
              {{ avatar.name }}
            </button>
          </div>
        </div>
        <p v-if="mode === 'edit'" class="hint">狀態請點選任務卡片上的狀態標籤修改</p>
        <div v-if="store.labels.length" class="field">
          <span class="field-label">標籤</span>
          <div class="labels">
            <button
              v-for="label in store.labels"
              :key="label.id"
              type="button"
              class="label-chip"
              :class="{ active: selectedLabels.includes(label.id) }"
              :style="{ '--lc': label.color }"
              @click="toggleLabel(label.id)"
            >
              {{ label.name }}
            </button>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="btn-secondary" @click="emit('close')">取消</button>
          <button type="button" class="btn-primary" @click="save">儲存</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal {
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow-lg;
  width: 100%;
  max-width: 480px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  h2 {
    font-size: 18px;
    font-weight: 700;
  }
}

.hint {
  font-size: 12px;
  color: $text-muted;
  padding: 8px 12px;
  background: $bg;
  border-radius: $radius-sm;
}

.date-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: $breakpoint-xs) {
    grid-template-columns: 1fr;
  }
}

.duration-hint {
  font-size: 12px;
  color: $text-muted;
  margin-top: -8px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: $text-muted;
}

input[type='text'],
input[type='date'] {
  padding: 10px 12px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  color: $text;

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 3px $primary-light;
  }
}

.field-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: $text-muted;
  margin-bottom: 8px;
}

.labels {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.avatar-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.avatar-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  border: 1px solid $border;
  color: $text-muted;
  background: $bg;

  &.active {
    border-color: $primary;
    color: $primary;
    background: $primary-light;
    font-weight: 600;
  }
}

.label-chip {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  border: 1px solid var(--lc);
  color: var(--lc);
  background: transparent;

  &.active {
    background: var(--lc);
    color: white;
  }
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.btn-primary {
  padding: 8px 20px;
  background: $primary;
  color: white;
  border-radius: $radius-sm;
  font-weight: 600;

  &:hover {
    background: $primary-dark;
  }
}

.btn-secondary {
  padding: 8px 20px;
  color: $text-muted;
  border-radius: $radius-sm;

  &:hover {
    background: $bg;
  }
}
</style>
