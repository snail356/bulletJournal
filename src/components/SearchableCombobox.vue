<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

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
const menuRef = ref<HTMLElement | null>(null)
const open = ref(false)
const inputValue = ref(props.modelValue)
const activeIndex = ref(-1)
/** 透過右側箭頭展開時，忽略輸入內容顯示全部選項 */
const browseAll = ref(false)
const suppressBlurCommit = ref(false)
const menuStyle = ref<Record<string, string>>({})

watch(
  () => props.modelValue,
  (value) => {
    if (value !== inputValue.value) inputValue.value = value
  },
)

const filteredOptions = computed(() => {
  const query = inputValue.value.trim().toLowerCase()
  if (browseAll.value || !query) {
    return [...props.options]
  }
  return props.options.filter((option) => option.toLowerCase().includes(query))
})

const hasExactMatch = computed(() => {
  const query = inputValue.value.trim().toLowerCase()
  if (!query) return false
  return props.options.some((option) => option.toLowerCase() === query)
})

watch(open, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  updateMenuPosition()
})

watch(filteredOptions, async () => {
  if (!open.value) return
  await nextTick()
  updateMenuPosition()
})

function updateMenuPosition() {
  const trigger = rootRef.value?.getBoundingClientRect()
  const menu = menuRef.value?.getBoundingClientRect()
  if (!trigger) return

  const width = Math.max(trigger.width, 240)
  let left = trigger.left
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8))

  let top = trigger.bottom + 4
  const menuHeight = menu?.height ?? 180
  if (top + menuHeight > window.innerHeight - 8) {
    top = Math.max(8, trigger.top - menuHeight - 4)
  }

  menuStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    maxWidth: `calc(100vw - 16px)`,
  }
}

async function openDropdown() {
  open.value = true
  activeIndex.value = -1
  await nextTick()
  updateMenuPosition()
}

function closeDropdown() {
  open.value = false
  activeIndex.value = -1
  browseAll.value = false
}

function toggleBrowseAll() {
  if (open.value) {
    if (browseAll.value) {
      closeDropdown()
    } else {
      browseAll.value = true
      activeIndex.value = -1
      nextTick(updateMenuPosition)
    }
    return
  }
  browseAll.value = true
  openDropdown()
}

function onTogglePointerDown(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  suppressBlurCommit.value = true
  toggleBrowseAll()
  window.setTimeout(() => {
    suppressBlurCommit.value = false
  }, 150)
}

function emitInput(value: string) {
  inputValue.value = value
  browseAll.value = false
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
  closeDropdown()
}

function commitCurrent() {
  const value = inputValue.value.trim()
  // 內容未變則不重複送出，避免 blur / outside 雙觸發造成使用次數膨脹
  if (value === props.modelValue.trim()) {
    closeDropdown()
    return
  }
  emit('update:modelValue', value)
  emit('commit', value)
  closeDropdown()
}

function onFocus() {
  openDropdown()
}

function onBlur() {
  window.setTimeout(() => {
    if (suppressBlurCommit.value) return
    const active = document.activeElement
    if (
      rootRef.value?.contains(active) ||
      menuRef.value?.contains(active)
    ) {
      return
    }
    commitCurrent()
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
  const target = e.target as Node
  if (rootRef.value?.contains(target) || menuRef.value?.contains(target)) return
  if (open.value) closeDropdown()
}

function closeOnScrollOrResize() {
  if (open.value) closeDropdown()
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  window.addEventListener('scroll', closeOnScrollOrResize, true)
  window.addEventListener('resize', closeOnScrollOrResize)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
  window.removeEventListener('scroll', closeOnScrollOrResize, true)
  window.removeEventListener('resize', closeOnScrollOrResize)
})
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
        @mousedown="onTogglePointerDown"
      >
        ▾
      </button>
    </div>

    <Teleport to="body">
      <ul
        v-if="open"
        ref="menuRef"
        class="options searchable-combobox-options"
        role="listbox"
        :style="menuStyle"
      >
        <li
          v-if="!browseAll && inputValue.trim() && !hasExactMatch"
          class="option hint"
        >
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
        <li
          v-if="!filteredOptions.length && !inputValue.trim()"
          class="option empty"
        >
          {{ emptyText }}
        </li>
        <li
          v-else-if="!filteredOptions.length && inputValue.trim()"
          class="option empty"
        >
          無相符紀錄，Enter 建立新內容
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.searchable-combobox {
  position: relative;
  width: 100%;
  min-width: 0;
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

@media (max-width: $breakpoint-xs) {
  .input {
    font-size: 16px;
    padding: 8px 10px;
  }
}
</style>

<style lang="scss">
@use '@/styles/variables' as *;

.searchable-combobox-options {
  position: fixed;
  z-index: 1400;
  max-height: min(240px, 45vh);
  overflow-y: auto;
  overflow-x: hidden;
  background: $surface;
  border: 1px solid $border;
  border-radius: $radius-sm;
  box-shadow: $shadow-lg;
  padding: 4px;
  box-sizing: border-box;

  .option {
    padding: 8px 10px;
    font-size: 12px;
    border-radius: 6px;
    cursor: pointer;
    color: $text;
    line-height: 1.45;
    white-space: normal;
    overflow-wrap: anywhere;
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
}
</style>
