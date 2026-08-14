<script setup lang="ts">
import { computed } from 'vue'
import type { TaskAvatar } from '@/types'
import AppIcon from '@/components/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    avatar: TaskAvatar
    size?: 'xs' | 'sm' | 'md'
  }>(),
  { size: 'sm' },
)

const iconSize = computed(() => (props.size === 'md' ? 'sm' : 'xs'))
</script>

<template>
  <span class="avatar-face" :class="size" :title="avatar.name">
    <img
      v-if="avatar.imageUrl"
      :src="avatar.imageUrl"
      :alt="avatar.name"
      draggable="false"
    />
    <AppIcon v-else :name="avatar.icon" :size="iconSize" />
  </span>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.avatar-face {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 50%;
  background: $primary-light;
  color: $primary;
  line-height: 1;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &.xs {
    width: 14px;
    height: 14px;
  }

  &.sm {
    width: 20px;
    height: 20px;
  }

  &.md {
    width: 32px;
    height: 32px;
  }
}
</style>
