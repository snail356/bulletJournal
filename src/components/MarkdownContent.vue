<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

const props = defineProps<{
  content: string
}>()

const rendered = computed(() => {
  const markdown = props.content.trim()
  if (!markdown) return ''
  // breaks: 單一 Enter 換行保留為 <br>（結束編輯後與 textarea 所見一致）
  return DOMPurify.sanitize(
    marked.parse(markdown, { async: false, breaks: true }),
  )
})
</script>

<template>
  <div class="markdown-content markdown-body" v-html="rendered" />
</template>

<style scoped lang="scss">
.markdown-content {
  min-width: 0;
}
</style>

<style lang="scss">
@use '@/styles/markdown';
</style>
