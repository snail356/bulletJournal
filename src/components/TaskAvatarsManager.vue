<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import { useTaskStore } from '@/stores/taskStore'
import { TASK_AVATAR_ICON_OPTIONS } from '@/utils/taskAvatars'

const store = useTaskStore()
</script>

<template>
  <div class="avatars-manager">
    <p class="desc">
      預設 5 個頭像，可改名稱與圖示。新增或編輯任務時可選一個，日曆會顯示成「圖示 任務名」。
    </p>
    <div class="avatar-list">
      <article v-for="avatar in store.taskAvatars" :key="avatar.id" class="avatar-card">
        <div class="preview">
          <span class="preview-icon">
            <AppIcon :name="avatar.icon" />
          </span>
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
        <div class="icon-field">
          <span class="field-label">圖示</span>
          <div class="icon-grid">
            <button
              v-for="icon in TASK_AVATAR_ICON_OPTIONS"
              :key="icon"
              type="button"
              class="icon-btn"
              :class="{ active: avatar.icon === icon }"
              :aria-label="icon"
              @click="store.updateTaskAvatar(avatar.id, { icon })"
            >
              <AppIcon :name="icon" size="xs" />
            </button>
          </div>
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
  margin-bottom: 16px;
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

.preview-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: $primary-light;
  color: $primary;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: $text-muted;
}

input {
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

.field-label {
  font-size: 12px;
  font-weight: 500;
  color: $text-muted;
  margin-bottom: 6px;
  display: block;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.icon-btn {
  height: 32px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  color: $text-muted;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    border-color: $primary;
    color: $primary;
  }

  &.active {
    border-color: $primary;
    background: $primary-light;
    color: $primary;
  }
}
</style>
