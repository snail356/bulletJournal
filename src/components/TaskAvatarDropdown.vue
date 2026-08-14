<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const store = useTaskStore()
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const current = computed(() => store.getTaskAvatar(props.modelValue))

function toggle() {
  open.value = !open.value
}

function select(id: string | null) {
  emit('update:modelValue', id)
  open.value = false
}

function onClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div v-if="current" ref="rootRef" class="avatar-dropdown">
    <button
      type="button"
      class="trigger"
      :title="`更換頭像（目前：${current.name}）`"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click.stop="toggle"
    >
      <AppIcon :name="current.icon" size="xs" />
    </button>

    <div v-if="open" class="menu" role="listbox">
      <button
        v-for="avatar in store.taskAvatars"
        :key="avatar.id"
        type="button"
        class="option"
        :class="{ active: modelValue === avatar.id }"
        @click.stop="select(avatar.id)"
      >
        <span class="option-icon">
          <AppIcon :name="avatar.icon" size="xs" />
        </span>
        {{ avatar.name }}
      </button>
      <button type="button" class="option clear" @click.stop="select(null)">
        移除頭像
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.avatar-dropdown {
  position: relative;
  flex-shrink: 0;
}

.trigger {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: $primary-light;
  color: $primary;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;

  &:hover {
    box-shadow: 0 0 0 2px rgba($primary, 0.25);
  }
}

.menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 120;
  min-width: 148px;
  background: $surface;
  border: 1px solid $border;
  border-radius: $radius-sm;
  box-shadow: $shadow-lg;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: $text;
  text-align: left;

  &:hover {
    background: $bg;
  }

  &.active {
    background: $primary-light;
    color: $primary;
    font-weight: 600;
  }

  &.clear {
    color: $text-muted;
    margin-top: 2px;
    border-top: 1px solid $border;
    border-radius: 0 0 6px 6px;
    padding-top: 8px;
  }
}

.option-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: $primary-light;
  color: $primary;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
