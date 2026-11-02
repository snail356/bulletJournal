<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import MarkdownContent from '@/components/MarkdownContent.vue'
import { useTaskStore } from '@/stores/taskStore'
import {
  SPHERE_AI_QUESTION_LIMIT,
  SPHERE_AI_QUESTIONS,
  type SphereAiTurn,
} from '@/utils/sphereAi'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
}

const props = defineProps<{
  positionStyle: Record<string, string>
}>()

const emit = defineEmits<{
  close: []
  layout: []
}>()

const store = useTaskStore()
const rootRef = ref<HTMLElement | null>(null)
const threadRef = ref<HTMLElement | null>(null)
const question = ref('')
const error = ref('')
const messages = ref<ChatMessage[]>([])
let nextId = 0

const canAsk = computed(
  () => question.value.trim().length > 0 && !store.sphereAiLoading,
)

function completedTurns(): SphereAiTurn[] {
  const turns: SphereAiTurn[] = []
  const list = messages.value
  for (let i = 0; i < list.length - 1; i++) {
    const current = list[i]
    const next = list[i + 1]
    if (current?.role === 'user' && next?.role === 'assistant') {
      turns.push({ question: current.text, answer: next.text })
      i += 1
    }
  }
  return turns
}

async function scrollThread() {
  await nextTick()
  const thread = threadRef.value
  if (thread) thread.scrollTop = thread.scrollHeight
  emit('layout')
}

async function requestAsk(text = question.value) {
  const trimmed = text.trim()
  if (!trimmed || store.sphereAiLoading) return
  error.value = ''
  const history = completedTurns()
  messages.value.push({ id: nextId++, role: 'user', text: trimmed })
  question.value = ''
  await scrollThread()
  try {
    const answer = await store.askSphereQuestion(trimmed, history)
    messages.value.push({ id: nextId++, role: 'assistant', text: answer })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '詢問 AI 失敗'
  }
  await scrollThread()
}

function onQuestionKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return
  e.preventDefault()
  void requestAsk()
}

function onDocumentPointerDown(e: PointerEvent) {
  const target = e.target
  if (!(target instanceof Node)) return
  if (rootRef.value?.contains(target)) return
  if (target instanceof Element && target.closest('.floating-sphere')) return
  emit('close')
}

watch(() => store.sphereAiLoading, () => {
  void scrollThread()
})

onMounted(async () => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  await nextTick()
  emit('layout')
  rootRef.value?.querySelector('textarea')?.focus()
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})

defineExpose({ rootRef })
</script>

<template>
  <aside
    ref="rootRef"
    class="sphere-ai"
    :style="props.positionStyle"
    role="dialog"
    aria-label="詢問 AI"
    @contextmenu.prevent
  >
    <header class="head">
      <h2>詢問 AI</h2>
      <button type="button" class="close" aria-label="關閉" @click="emit('close')">
        關閉
      </button>
    </header>
    <p class="hint">可連續追問今天的進度與未完成代辦。關掉後這段對話會清空。</p>
    <div class="presets">
      <button
        v-for="item in SPHERE_AI_QUESTIONS"
        :key="item.key"
        type="button"
        :disabled="store.sphereAiLoading"
        @click="requestAsk(item.question)"
      >
        {{ item.label }}
      </button>
    </div>
    <div
      v-if="messages.length || error || store.sphereAiLoading"
      ref="threadRef"
      class="thread"
    >
      <div
        v-for="message in messages"
        :key="message.id"
        class="bubble"
        :class="message.role"
      >
        <MarkdownContent v-if="message.role === 'assistant'" :content="message.text" />
        <p v-else class="user-text">{{ message.text }}</p>
      </div>
      <p v-if="store.sphereAiLoading" class="loading">正在整理回答…</p>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
    <form class="ask" @submit.prevent="requestAsk()">
      <textarea
        v-model="question"
        :maxlength="SPHERE_AI_QUESTION_LIMIT"
        rows="2"
        placeholder="例如：今天進度如何？還有哪些未完成代辦？"
        :disabled="store.sphereAiLoading"
        @keydown="onQuestionKeydown"
      />
      <button type="submit" class="send" :disabled="!canAsk">
        {{ store.sphereAiLoading ? '詢問中…' : '送出' }}
      </button>
    </form>
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.sphere-ai {
  position: fixed;
  z-index: 50;
  display: flex;
  flex-direction: column;
  width: min(380px, calc(100vw - 24px));
  max-height: min(520px, calc(100vh - 24px));
  overflow: hidden;
  padding: 14px 14px 12px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(103, 232, 249, 0.35);
  border-radius: $radius;
  box-shadow:
    0 10px 28px rgba(34, 211, 238, 0.12),
    $shadow-lg;
  color: $text;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
  }
}

.close,
.presets button,
.send {
  border-radius: $radius-sm;
  font-size: 12px;
}

.close {
  padding: 4px 8px;
  color: $text-muted;

  &:hover {
    background: $bg;
    color: $text;
  }
}

.hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: $text-muted;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;

  button {
    padding: 5px 10px;
    color: #0e7490;
    background: rgba(207, 250, 254, 0.55);
    border: 1px solid rgba(103, 232, 249, 0.45);

    &:hover:not(:disabled) {
      background: rgba(165, 243, 252, 0.7);
    }

    &:disabled {
      opacity: 0.55;
    }
  }
}

.thread {
  flex: 1;
  min-height: 0;
  margin-top: 10px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bubble {
  max-width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.6;

  &.user {
    align-self: flex-end;
    max-width: 92%;
    background: rgba(207, 250, 254, 0.75);
  }

  &.assistant {
    background: $bg;
  }
}

.user-text {
  margin: 0;
  white-space: pre-wrap;
}

.ask {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  flex-shrink: 0;
}

textarea {
  width: 100%;
  resize: vertical;
  min-height: 72px;
  padding: 8px 10px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $surface;
  color: $text;
  font: inherit;
  font-size: 13px;
  line-height: 1.55;

  &:focus {
    outline: 2px solid rgba(34, 211, 238, 0.45);
    border-color: transparent;
  }

  &:disabled {
    background: $bg;
  }
}

.send {
  align-self: flex-end;
  padding: 7px 14px;
  background: #0891b2;
  color: white;
  font-weight: 600;

  &:hover:not(:disabled) {
    background: #0e7490;
  }

  &:disabled {
    opacity: 0.5;
  }
}

.error {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #b91c1c;
}

.loading {
  margin: 10px 0 0;
  font-size: 13px;
  color: $text-muted;
}

</style>
