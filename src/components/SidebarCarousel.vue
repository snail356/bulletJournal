<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { useTaskStore } from '@/stores/taskStore'
import { getSidebarCarouselCurrentImage } from '@/utils/sidebarCarousel'

const store = useTaskStore()
const now = ref(Date.now())
let timer = 0

onMounted(() => {
  now.value = Date.now()
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 15_000)
  document.addEventListener('visibilitychange', onVisibility)
})

onUnmounted(() => {
  window.clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibility)
})

function onVisibility() {
  if (document.visibilityState === 'visible') now.value = Date.now()
}

const currentImage = computed(() =>
  getSidebarCarouselCurrentImage(store.sidebarCarousel, now.value),
)
</script>

<template>
  <div class="sidebar-carousel">
    <img
      v-if="currentImage"
      :src="currentImage.imageUrl"
      :alt="currentImage.fileName"
      class="carousel-image"
    />
    <div v-else class="carousel-empty">
      <AppIcon name="image" />
      <span>尚未上傳圖片</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.sidebar-carousel {
  background: $bg;
  border-radius: $radius;
  overflow: hidden;
  aspect-ratio: 4 / 3;
}

.carousel-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.carousel-empty {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: $text-muted;
  font-size: 12px;
}
</style>
