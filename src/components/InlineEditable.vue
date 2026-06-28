<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    tag?: 'h3' | 'p' | 'span'
    multiline?: boolean
    placeholder?: string
    hint?: boolean
    saveWhenEmpty?: boolean
  }>(),
  {
    tag: 'span',
    multiline: false,
    placeholder: '',
    hint: false,
    saveWhenEmpty: false,
  },
)

const emit = defineEmits<{
  save: [value: string]
  'editing-change': [editing: boolean]
}>()

const editing = ref(false)
const elRef = ref<HTMLElement | null>(null)

function displayText() {
  if (props.hint && !props.modelValue && !editing.value && props.placeholder) {
    return props.placeholder
  }
  return props.modelValue
}

function syncContent() {
  const el = elRef.value
  if (!el || editing.value) return
  el.textContent = displayText()
}

async function startEditing() {
  if (editing.value) return
  editing.value = true
  emit('editing-change', true)
  await nextTick()
  const el = elRef.value
  if (!el) return
  el.textContent = props.hint && !props.modelValue ? '' : props.modelValue
  el.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

function finishEditing() {
  const el = elRef.value
  if (!el || !editing.value) return

  const text = el.innerText.replace(/\n$/, '').trim()
  editing.value = false
  emit('editing-change', false)

  if (text) {
    emit('save', text)
    el.textContent = text
  } else if (props.saveWhenEmpty) {
    emit('save', '')
  } else {
    syncContent()
  }
}

function onClick() {
  if (!editing.value) startEditing()
}

function onBlur() {
  finishEditing()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !props.multiline) {
    e.preventDefault()
    finishEditing()
  }
  if (e.key === 'Escape') {
    const el = elRef.value
    const text = el?.innerText.replace(/\n$/, '').trim() ?? ''
    editing.value = false
    emit('editing-change', false)
    if (!text && props.saveWhenEmpty) {
      emit('save', '')
    } else {
      syncContent()
    }
    el?.blur()
  }
}

watch(
  () => props.modelValue,
  () => {
    if (!editing.value) syncContent()
  },
)

watch(editing, (v) => {
  if (!v) nextTick(syncContent)
})

onMounted(syncContent)

defineExpose({ startEditing })
</script>

<template>
  <component
    :is="tag"
    ref="elRef"
    class="inline-editable"
    :class="{
      editing,
      'is-hint': hint && !modelValue && !editing,
    }"
    :contenteditable="editing"
    :data-placeholder="placeholder"
    @click="onClick"
    @blur="onBlur"
    @keydown="onKeydown"
  />
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.inline-editable {
  outline: none;
  cursor: text;
  min-width: 1em;
  max-width: 100%;
  word-break: break-word;
  overflow-wrap: anywhere;

  &.is-hint {
    color: $text-muted;
  }

  &:not(.is-hint):hover {
    color: $primary;
  }

  &.editing {
    cursor: text;
  }

  &[contenteditable='true']:empty::before {
    content: attr(data-placeholder);
    color: $text-muted;
    pointer-events: none;
  }
}
</style>
