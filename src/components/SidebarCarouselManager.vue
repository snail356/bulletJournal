<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AppSwitch from '@/components/AppSwitch.vue'
import { useSimpleReorderDrag } from '@/composables/useReorderDrag'
import { useTaskStore } from '@/stores/taskStore'
import {
  SIDEBAR_CAROUSEL_MAX_HOURS,
  SIDEBAR_CAROUSEL_MAX_IMAGES,
  SIDEBAR_CAROUSEL_MIN_HOURS,
  getSidebarCarouselCurrentImage,
} from '@/utils/sidebarCarousel'
import type { SidebarCarouselMode } from '@/types'

const store = useTaskStore()
const uploadError = ref('')
const uploading = ref(false)
const { draggingId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd } =
  useSimpleReorderDrag(
    () => store.sidebarCarousel.images,
    (fromId, toId) => store.reorderSidebarCarouselImages(fromId, toId),
  )

const remaining = computed(
  () => SIDEBAR_CAROUSEL_MAX_IMAGES - store.sidebarCarousel.images.length,
)
const currentImage = computed(() =>
  getSidebarCarouselCurrentImage(store.sidebarCarousel),
)

function onIntervalHoursChange(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  store.setSidebarCarouselIntervalHours(value)
}

function setMode(mode: SidebarCarouselMode) {
  store.setSidebarCarouselMode(mode)
}

async function onUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  if (!files.length) return
  uploading.value = true
  uploadError.value = ''
  try {
    await store.addSidebarCarouselImages(files)
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : '上傳失敗'
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="carousel-manager">
    <p class="desc">
      開啟後會在左側小日曆上方顯示圖片。可每日換一張，或依自訂小時數輪播。關閉後左側圖片框會隱藏。
    </p>

    <div class="enable-row">
      <div>
        <strong>顯示側邊欄圖片</strong>
        <p>關閉時左側不顯示圖片框</p>
      </div>
      <AppSwitch
        :model-value="store.sidebarCarousel.enabled"
        @update:model-value="store.setSidebarCarouselEnabled($event)"
      />
    </div>

    <fieldset class="mode-field">
      <legend>輪播方式</legend>
      <label class="mode-option" :class="{ active: store.sidebarCarousel.mode === 'daily' }">
        <input
          type="radio"
          name="carousel-mode"
          value="daily"
          :checked="store.sidebarCarousel.mode === 'daily'"
          @change="setMode('daily')"
        />
        <span>
          <strong>每日輪播</strong>
          <em>一天顯示一張，隔日換下一張</em>
        </span>
      </label>
      <label class="mode-option" :class="{ active: store.sidebarCarousel.mode === 'interval' }">
        <input
          type="radio"
          name="carousel-mode"
          value="interval"
          :checked="store.sidebarCarousel.mode === 'interval'"
          @change="setMode('interval')"
        />
        <span>
          <strong>自訂間隔</strong>
          <em>依設定的小時數換下一張</em>
        </span>
      </label>
    </fieldset>

    <label v-if="store.sidebarCarousel.mode === 'interval'" class="hours-field">
      每隔幾小時換下一張
      <input
        :value="store.sidebarCarousel.intervalHours"
        type="number"
        :min="SIDEBAR_CAROUSEL_MIN_HOURS"
        :max="SIDEBAR_CAROUSEL_MAX_HOURS"
        @change="onIntervalHoursChange"
      />
      <span class="hint">可填 {{ SIDEBAR_CAROUSEL_MIN_HOURS }}–{{ SIDEBAR_CAROUSEL_MAX_HOURS }} 小時</span>
    </label>

    <div class="toolbar">
      <label class="upload-btn" :class="{ disabled: remaining <= 0 || uploading }">
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          :disabled="remaining <= 0 || uploading"
          @change="onUpload"
        />
        <AppIcon name="image" size="xs" />
        {{ uploading ? '上傳中…' : '上傳圖片' }}
      </label>
      <span class="count">{{ store.sidebarCarousel.images.length }} / {{ SIDEBAR_CAROUSEL_MAX_IMAGES }}</span>
    </div>
    <p v-if="uploadError" class="error">{{ uploadError }}</p>

    <p v-if="!store.sidebarCarousel.images.length" class="empty">尚未上傳圖片</p>
    <ul v-else class="image-list">
      <li
        v-for="image in store.sidebarCarousel.images"
        :key="image.id"
        class="image-card"
        :class="{
          dragging: draggingId === image.id,
          'drag-over': dragOverId === image.id,
          current: currentImage?.id === image.id,
        }"
        @dragover="onDragOver($event, image.id)"
        @drop="onDrop($event, image.id)"
      >
        <span
          class="drag-handle"
          draggable="true"
          aria-label="拖曳排序"
          @dragstart="onDragStart($event, image.id)"
          @dragend="onDragEnd"
        >
          <AppIcon name="grip-vertical" />
        </span>
        <img :src="image.imageUrl" :alt="image.fileName" />
        <div class="meta">
          <span class="name">{{ image.fileName }}</span>
          <span v-if="currentImage?.id === image.id" class="badge">目前顯示</span>
        </div>
        <button
          type="button"
          class="icon-action danger"
          data-tip="刪除圖片"
          aria-label="刪除圖片"
          @click="store.deleteSidebarCarouselImage(image.id)"
        >
          <AppIcon name="trash" size="xs" />
        </button>
      </li>
    </ul>
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

.enable-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0 16px;
  border-bottom: 1px solid $border;
  margin-bottom: 16px;

  strong {
    display: block;
    font-size: 14px;
    font-weight: 600;
  }

  p {
    margin-top: 2px;
    font-size: 12px;
    color: $text-muted;
  }
}

.mode-field {
  border: 0;
  margin: 0 0 16px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  legend {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
    padding: 0;
  }
}

.mode-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  cursor: pointer;

  &:hover,
  &.active {
    border-color: $primary;
    background: $primary-light;
  }

  input {
    margin-top: 3px;
  }

  strong {
    display: block;
    font-size: 13px;
  }

  em {
    display: block;
    margin-top: 2px;
    font-style: normal;
    font-size: 12px;
    color: $text-muted;
  }
}

.hours-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 13px;
  font-weight: 600;

  input {
    width: 120px;
    padding: 8px 10px;
    border: 1px solid $border;
    border-radius: $radius-sm;
    font-weight: 600;

    &:focus {
      outline: none;
      border-color: $primary;
      box-shadow: 0 0 0 3px $primary-light;
    }
  }
}

.hint {
  font-size: 12px;
  font-weight: 500;
  color: $text-muted;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: $radius-sm;
  background: $primary;
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(.disabled) {
    background: $primary-dark;
  }

  &.disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
}

.count,
.empty {
  font-size: 12px;
  color: $text-muted;
}

.error {
  color: #ef4444;
  font-size: 12px;
  margin-bottom: 10px;
}

.image-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.image-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $surface;

  &.dragging {
    opacity: 0.45;
  }

  &.drag-over {
    box-shadow: inset 0 -2px 0 $primary;
  }

  &.current {
    border-color: $primary;
  }

  img {
    width: 56px;
    height: 42px;
    object-fit: cover;
    border-radius: 6px;
    flex-shrink: 0;
    background: $bg;
  }
}

.drag-handle {
  color: $text-muted;
  font-size: 14px;
  cursor: grab;
  opacity: 0.4;
  line-height: 1;
  flex-shrink: 0;

  &:hover {
    opacity: 0.8;
  }

  &:active {
    cursor: grabbing;
  }
}

.meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  align-self: flex-start;
  font-size: 11px;
  font-weight: 600;
  color: $primary;
  background: $primary-light;
  border-radius: 999px;
  padding: 1px 8px;
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
  flex-shrink: 0;

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
