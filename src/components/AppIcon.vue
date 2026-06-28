<script setup lang="ts">
import { computed } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { appIcons, type AppIconName } from '@/plugins/fontawesome'

const props = withDefaults(
  defineProps<{
    name: AppIconName
    size?: 'xs' | 'sm' | 'lg'
  }>(),
  { size: 'sm' },
)

const icon = computed(() => appIcons[props.name])
</script>

<template>
  <FontAwesomeIcon :icon="icon" :size="size" class="app-icon" />
</template>

<style scoped lang="scss">
.app-icon {
  display: block;
  line-height: 1;
}
</style>
