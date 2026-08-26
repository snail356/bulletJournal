<script setup lang="ts">
import { ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PopoverIconButton from '@/components/PopoverIconButton.vue'

const props = withDefaults(
  defineProps<{
    title: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    label?: string
    disabled?: boolean
    variant?: 'default' | 'overlay'
  }>(),
  {
    message: '',
    confirmLabel: '確定',
    cancelLabel: '取消',
    label: '刪除',
    disabled: false,
    variant: 'default',
  },
)

const emit = defineEmits<{
  confirm: []
}>()

const visible = ref(false)

function open() {
  if (props.disabled) return
  visible.value = true
}

function onConfirm() {
  emit('confirm')
}
</script>

<template>
  <span class="delete-icon-button" :class="variant" @click.stop>
    <slot name="trigger" :open="open">
      <PopoverIconButton
        icon="trash"
        :label="label"
        :disabled="disabled"
        :variant="variant"
        danger
        @click="open"
      />
    </slot>
    <ConfirmDialog
      :visible="visible"
      :title="title"
      :message="message"
      :confirm-label="confirmLabel"
      :cancel-label="cancelLabel"
      danger
      @confirm="onConfirm"
      @close="visible = false"
    />
  </span>
</template>

<style scoped lang="scss">
.delete-icon-button {
  display: inline-flex;
  line-height: 0;

  &.overlay {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 1;
  }
}
</style>
