<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { Attachment } from '@/types'
import AppIcon from './AppIcon.vue'

defineProps<{
  attachment: Attachment | null
}>()

const emit = defineEmits<{
  close: []
}>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div v-if="attachment" class="lightbox" @click.self="emit('close')">
      <button type="button" class="close" aria-label="關閉" @click="emit('close')">
        <AppIcon name="xmark" />
      </button>
      <img :src="attachment.url" :alt="attachment.fileName" />
      <p class="caption">{{ attachment.fileName }}</p>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.close {
  position: absolute;
  top: 20px;
  right: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  font-size: 18px;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
}

img {
  max-width: 90vw;
  max-height: 80vh;
  border-radius: 8px;
  object-fit: contain;
}

.caption {
  margin-top: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
}
</style>
