<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import DeleteIconButton from '@/components/DeleteIconButton.vue'
import IconPopselect from '@/components/IconPopselect.vue'
import TaskAvatarFace from '@/components/TaskAvatarFace.vue'
import { useTaskStore } from '@/stores/taskStore'
import { isDefaultTaskAvatar, TASK_AVATAR_ICON_OPTIONS } from '@/utils/taskAvatars'
import type { TaskAvatar } from '@/types'

const store = useTaskStore()
const uploadError = ref('')
const uploadingId = ref<string | null>(null)

async function onUpload(avatar: TaskAvatar, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploadingId.value = avatar.id
  uploadError.value = ''
  try {
    await store.setTaskAvatarImage(avatar.id, file)
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : '上傳失敗'
  } finally {
    uploadingId.value = null
  }
}

async function onUploadNew(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploadingId.value = 'new'
  uploadError.value = ''
  try {
    await store.createUploadedTaskAvatar(file)
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : '上傳失敗'
  } finally {
    uploadingId.value = null
  }
}
</script>

<template>
  <div class="avatars-manager">
    <p class="desc">
      預設 5 個頭像，可改名稱、圖示，或上傳圖片當頭像。也可再上傳新的自訂頭像。任務與日曆會優先顯示上傳的圖片。
    </p>
    <div class="toolbar">
      <label class="upload-new">
        <input type="file" accept="image/*" hidden @change="onUploadNew" />
        <AppIcon name="image" size="xs" />
        {{ uploadingId === 'new' ? '上傳中…' : '上傳新頭像' }}
      </label>
    </div>
    <p v-if="uploadError" class="error">{{ uploadError }}</p>
    <div class="avatar-list">
      <article v-for="avatar in store.taskAvatars" :key="avatar.id" class="avatar-card">
        <div class="preview">
          <TaskAvatarFace :avatar="avatar" size="md" />
          <span class="preview-name">{{ avatar.name }}</span>
        </div>
        <label>
          名稱
          <input
            :value="avatar.name"
            type="text"
            maxlength="12"
            @change="store.updateTaskAvatar(avatar.id, { name: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <div class="upload-row">
          <label class="upload-btn">
            <input type="file" accept="image/*" hidden @change="onUpload(avatar, $event)" />
            {{ uploadingId === avatar.id ? '上傳中…' : avatar.imageUrl ? '更換圖片' : '上傳圖片' }}
          </label>
          <IconPopselect
            :model-value="avatar.icon"
            :options="TASK_AVATAR_ICON_OPTIONS"
            :title="avatar.imageUrl ? '選擇圖示（無圖片時顯示）' : '選擇圖示'"
            @update:model-value="store.updateTaskAvatar(avatar.id, { icon: $event })"
          />
          <button
            v-if="avatar.imageUrl"
            type="button"
            class="icon-action"
            data-tip="改回圖示"
            aria-label="改回圖示"
            @click="store.clearTaskAvatarImage(avatar.id)"
          >
            <AppIcon name="rotate-left" size="xs" />
          </button>
          <DeleteIconButton
            v-if="!isDefaultTaskAvatar(avatar.id)"
            title="刪除頭像"
            :message="`確定刪除「${avatar.name}」？使用中的任務將改為未選頭像。`"
            label="刪除頭像"
            @confirm="store.deleteCustomTaskAvatar(avatar.id)"
          />
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.desc {
  color: $text-muted;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 12px;
}

.toolbar {
  margin-bottom: 12px;
}

.upload-new,
.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: $radius-sm;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.upload-new {
  background: $primary;
  color: white;

  &:hover {
    background: $primary-dark;
  }
}

.upload-btn {
  border: 1px solid $border;
  color: $primary;
  background: $primary-light;

  &:hover {
    border-color: $primary;
  }
}

.error {
  color: #ef4444;
  font-size: 12px;
  margin-bottom: 10px;
}

.avatar-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.avatar-card {
  background: $surface;
  border: 1px solid $border;
  border-radius: $radius;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: $text-muted;
}

input[type='text'] {
  padding: 8px 10px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  color: $text;
  font-weight: 600;

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 3px $primary-light;
  }
}

.upload-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.icon-action {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: $radius-sm;
  color: $text-muted;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: $primary;
    background: $primary-light;
  }

  &.danger:hover {
    color: #ef4444;
    background: #fef2f2;
  }

  &::after {
    content: attr(data-tip);
    position: absolute;
    left: 50%;
    bottom: calc(100% + 6px);
    transform: translateX(-50%);
    padding: 4px 8px;
    border-radius: 6px;
    background: $text;
    color: white;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.12s;
    z-index: 2;
  }

  &:hover::after,
  &:focus-visible::after {
    opacity: 1;
  }
}
</style>
