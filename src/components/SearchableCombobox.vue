<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: string[]
    placeholder?: string
    label?: string
    emptyText?: string
  }>(),
  {
    placeholder: '輸入或選擇…',
    label: '',
    emptyText: '沒有符合的紀錄',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  commit: [value: string]
  select: [value: string]
}>()

const rootRef = ref<HTMLElement | null>(null)
const open = ref(false)
const inputValue = ref(props.modelValue)
const activeIndex = ref(-1)

watch(
  () => props.modelValue,
  (value) => {
    if (value !== inputValue.value) inputValue.value = value
  },
)

const filteredOptions = computed(() => {
  const query = inputValue.value.trim().toLowerCase()
  if (!query) {
    return [...props.options]
  }
  return props.options.filter((option) => option.toLowerCase().includes(query))
})

const hasExactMatch = computed(() => {
  const query = inputValue.value.trim().toLowerCase()
  if (!query) return false
  return props.options.some((option) => option.toLowerCase() === query)
})

function openDropdown() {
  open.value = true
  activeIndex.value = -1
}

function closeDropdown() {
  open.value = false
  activeIndex.value = -1
}

function emitInput(value: string) {
  inputValue.value = value
  emit('update:modelValue', value)
  openDropdown()
}

function onInput(e: Event) {
  emitInput((e.target as HTMLInputElement).value)
}

function selectOption(option: string) {
  inputValue.value = option
  emit('update:modelValue', option)
  emit('select', option)
  emit('commit', option)
  closeDropdown()
}

function commitCurrent() {
  emit('commit', inputValue.value.trim())
  closeDropdown()
}

function onFocus() {
  openDropdown()
}

function onBlur() {
  window.setTimeout(() => {
    if (!rootRef.value?.contains(document.activeElement)) {
      commitCurrent()
    }
  }, 120)
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    openDropdown()
    e.preventDefault()
    return
  }

  if (e.key === 'Escape') {
    closeDropdown()
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    if (activeIndex.value >= 0 && filteredOptions.value[activeIndex.value]) {
      selectOption(filteredOptions.value[activeIndex.value])
    } else {
      commitCurrent()
    }
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!filteredOptions.value.length) return
    activeIndex.value = (activeIndex.value + 1) % filteredOptions.value.length
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!filteredOptions.value.length) return
    activeIndex.value =
      activeIndex.value <= 0
        ? filteredOptions.value.length - 1
        : activeIndex.value - 1
  }
}

function onClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    commitCurrent()
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="rootRef" class="searchable-combobox">
    <label v-if="label" class="field-label">{{ label }}</label>
    <div class="input-wrap">
      <input
        type="text"
        class="input"
        :value="inputValue"
        :placeholder="placeholder"
        autocomplete="off"
        role="combobox"
        :aria-expanded="open"
        aria-autocomplete="list"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <button
        type="button"
        class="toggle-btn"
        tabindex="-1"
        aria-label="展開選項"
        @mousedown.prevent
        @click="open ? closeDropdown() : openDropdown()"
      >
        ▾
      </button>
    </div>

    <ul v-if="open" class="options" role="listbox">
      <li v-if="inputValue.trim() && !hasExactMatch" class="option hint">
        使用新內容：「{{ inputValue.trim() }}」
      </li>
      <li
        v-for="(option, index) in filteredOptions"
        :key="option"
        role="option"
        class="option"
        :class="{ active: index === activeIndex }"
        @mousedown.prevent
        @click="selectOption(option)"
      >
        {{ option }}
      </li>
      <li v-if="!filteredOptions.length && !inputValue.trim()" class="option empty">
        {{ emptyText }}
      </li>
      <li
        v-else-if="!filteredOptions.length && inputValue.trim()"
        class="option empty"
      >
        無相符紀錄，Enter 建立新內容
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.searchable-combobox {
  position: relative;
  width: 100%;
}

.field-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
  margin-bottom: 4px;
}

.input-wrap {
  display: flex;
  align-items: stretch;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $surface;
  overflow: hidden;

  &:focus-within {
    border-color: $primary;
    box-shadow: 0 0 0 3px $primary-light;
  }
}

.input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  font-size: 12px;
  color: $text;
  border: none;
  background: transparent;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: $text-muted;
    opacity: 0.7;
  }
}

.toggle-btn {
  width: 28px;
  flex-shrink: 0;
  color: $text-muted;
  font-size: 12px;
  border-left: 1px solid $border;

  &:hover {
    background: $bg;
    color: $primary;
  }
}

.options {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 120;
  max-height: 180px;
  overflow-y: auto;
  background: $surface;
  border: 1px solid $border;
  border-radius: $radius-sm;
  box-shadow: $shadow-lg;
  padding: 4px;
}

.option {
  padding: 8px 10px;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  color: $text;
  line-height: 1.4;
  word-break: break-word;

  &:hover,
  &.active {
    background: $primary-light;
    color: $primary;
  }

  &.hint {
    cursor: default;
    color: $text-muted;
    font-style: italic;
    background: $bg;

    &:hover {
      background: $bg;
      color: $text-muted;
    }
  }

  &.empty {
    cursor: default;
    color: $text-muted;
    text-align: center;

    &:hover {
      background: transparent;
      color: $text-muted;
    }
  }
}
</style>
