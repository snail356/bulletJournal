<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  code: string
}>()

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    // 瀏覽器不允許剪貼簿時略過
  }
}
</script>

<template>
  <div class="code-snippet">
    <button
      type="button"
      class="copy-btn"
      :title="copied ? '已複製' : '複製程式碼'"
      :aria-label="copied ? '已複製' : '複製程式碼'"
      @click.stop="copyCode"
    >
      <AppIcon :name="copied ? 'check' : 'copy'" size="xs" />
    </button>
    <pre class="code-block"><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.code-snippet {
  position: relative;
  min-width: 0;
}

.copy-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.92);
  color: $text-muted;
  border: 1px solid $border;
  box-shadow: $shadow;

  &:hover {
    color: $primary;
    border-color: $primary;
  }
}

.code-block {
  margin: 0;
  padding: 12px 40px 12px 12px;
  border-radius: $radius-sm;
  background: #1f2937;
  color: #e5e7eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  overflow-x: auto;
  white-space: pre;
  word-break: normal;

  code {
    font-family: inherit;
    font-size: inherit;
    background: transparent;
    padding: 0;
    color: inherit;
  }
}
</style>
