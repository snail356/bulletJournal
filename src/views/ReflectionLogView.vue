<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useTaskStore } from '@/stores/taskStore'
import { formatDisplayDate, todayString } from '@/utils/date'
import { getGeminiModel, hasGeminiApiKey } from '@/utils/gemini'
import type { DailyReflection } from '@/types'

const store = useTaskStore()
const selectedDate = ref<string | null>(null)
const confirmVisible = ref(false)
const pendingDelete = ref<DailyReflection | null>(null)
const detailScrollRef = ref<HTMLElement | null>(null)
const showBackToTop = ref(false)

function onDetailScroll() {
  showBackToTop.value = (detailScrollRef.value?.scrollTop ?? 0) > 200
}

function scrollDetailToTop() {
  detailScrollRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

const aiConfirmVisible = ref(false)
const aiError = ref('')

const reflections = computed(() => store.dailyReflectionsSorted)

const selected = computed(() => {
  if (!selectedDate.value) return null
  return store.getReflectionByDate(selectedDate.value) ?? null
})

const isSelectedToday = computed(
  () => selected.value?.date === todayString(),
)

const canEditSelected = computed(
  () => selected.value?.status === 'draft',
)

const renderedAiAdvice = computed(() => {
  const markdown = selected.value?.aiManagerAdvice?.trim()
  if (!markdown) return ''
  return DOMPurify.sanitize(marked.parse(markdown, { async: false }))
})

const aiConfirmMessage = computed(() => {
  const usage = store.geminiUsage
  const last = usage.lastCalledAt
    ? formatDateTime(usage.lastCalledAt)
    : '尚無'
  return [
    `本次將消耗 1 次 Gemini API 成功呼叫。`,
    ``,
    `目前本機累計成功呼叫：${usage.totalSuccessCalls} 次`,
    `最後呼叫時間：${last}`,
    `模型：${getGeminiModel()}`,
    ``,
    `用量為本機計數，非 Google 帳單全貌。確認後才會真正發送請求。`,
  ].join('\n')
})

watch(
  reflections,
  (list) => {
    if (!list.length) {
      selectedDate.value = null
      return
    }
    const today = todayString()
    const hasToday = list.some((item) => item.date === today)
    const selectedValid =
      !!selectedDate.value &&
      list.some((item) => item.date === selectedDate.value)

    if (!selectedValid) {
      selectedDate.value = hasToday ? today : list[0].date
    }
  },
  { immediate: true },
)

// 當日日誌內容更新（儲存草稿／完成提交）後，自動選取今日並捲到頂部
watch(
  () => store.getReflectionByDate(todayString())?.updatedAt,
  async (updatedAt, prev) => {
    if (!updatedAt || updatedAt === prev) return
    const today = todayString()
    if (!reflections.value.some((item) => item.date === today)) return
    selectedDate.value = today
    aiError.value = ''
    showBackToTop.value = false
    await nextTick()
    detailScrollRef.value?.scrollTo({ top: 0 })
  },
)

function selectDate(date: string) {
  selectedDate.value = date
  aiError.value = ''
  detailScrollRef.value?.scrollTo({ top: 0 })
  showBackToTop.value = false
}

function previewText(reflection: DailyReflection): string {
  const parts = [
    reflection.morningContent,
    reflection.afternoon1to3Content,
    reflection.afternoonAfter3Content,
    reflection.summaryContent,
  ]
    .map((text) => text.trim())
    .filter(Boolean)
  if (!parts.length) return '（尚未填寫內容）'
  const joined = parts.join(' · ')
  return joined.length > 60 ? `${joined.slice(0, 60)}…` : joined
}

function displayContent(text: string): string {
  const trimmed = text.trim()
  return trimmed || '（未填寫）'
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

function requestDelete(reflection: DailyReflection) {
  pendingDelete.value = reflection
  confirmVisible.value = true
}

function confirmDelete() {
  if (!pendingDelete.value) return
  store.deleteDailyReflection(pendingDelete.value.id)
  pendingDelete.value = null
}

function editSelectedJournal() {
  if (!selected.value || selected.value.status !== 'draft') return
  store.openDraftReflectionEditor(selected.value.date)
}

function requestAiAdvice() {
  aiError.value = ''
  if (!hasGeminiApiKey()) {
    aiError.value =
      '尚未設定 VITE_GEMINI_API_KEY。請參考 docs/ai-manager-advice.md，於 .env 設定後重啟 npm run dev。'
    return
  }
  aiConfirmVisible.value = true
}

async function confirmAiAdvice() {
  if (!selectedDate.value) return
  aiError.value = ''
  try {
    await store.generateAiManagerAdvice(selectedDate.value)
  } catch (error) {
    aiError.value =
      error instanceof Error ? error.message : '產生 AI 主管建議失敗'
  }
}
</script>

<template>
  <div class="reflection-view">
    <header class="page-header">
      <h1>回顧日誌</h1>
      <p class="subtitle">
        依日期瀏覽每日回顧；未完成草稿與已提交紀錄同樣呈現，皆可呼叫 AI 主管建議
      </p>
    </header>

    <div v-if="reflections.length" class="layout">
      <aside class="timeline" aria-label="回顧日期列表">
        <button
          v-for="item in reflections"
          :key="item.id"
          type="button"
          class="date-item"
          :class="{ active: item.date === selectedDate }"
          @click="selectDate(item.date)"
        >
          <span class="date-row">
            <span class="date-label">{{ formatDisplayDate(item.date) }}</span>
            <span v-if="item.status === 'draft'" class="badge draft">草稿</span>
            <span
              v-else-if="item.date === todayString()"
              class="badge today"
            >今日</span>
          </span>
          <span class="date-preview">{{ previewText(item) }}</span>
        </button>
      </aside>

      <section v-if="selected" class="detail">
        <div
          ref="detailScrollRef"
          class="detail-scroll"
          @scroll.passive="onDetailScroll"
        >
          <div class="detail-header">
            <div>
              <h2>{{ formatDisplayDate(selected.date) }}</h2>
              <p class="detail-meta">
                <template v-if="selected.status === 'draft'">
                  草稿 · 尚未完成提交，仍可呼叫 AI 主管
                </template>
                <template v-else-if="isSelectedToday">今日回顧報告</template>
                <template v-else>完整回顧報告</template>
              </p>
            </div>
            <div class="detail-actions">
              <button
                v-if="canEditSelected"
                type="button"
                class="edit"
                aria-label="編輯當日日誌"
                @click="editSelectedJournal"
              >
                <AppIcon name="pen" size="sm" />
              </button>
              <button
                type="button"
                class="delete"
                aria-label="刪除此日回顧"
                @click="requestDelete(selected)"
              >
                <AppIcon name="trash" size="sm" />
              </button>
            </div>
          </div>

          <article class="report">
            <section class="block">
              <h3 class="hint">早上</h3>
              <p class="body">{{ displayContent(selected.morningContent) }}</p>
            </section>
            <section class="block">
              <h3 class="hint">下午1點-3點</h3>
              <p class="body">{{ displayContent(selected.afternoon1to3Content) }}</p>
            </section>
            <section class="block">
              <h3 class="hint">下午3點後</h3>
              <p class="body">{{ displayContent(selected.afternoonAfter3Content) }}</p>
            </section>
            <section class="block">
              <h3 class="hint">當日總結</h3>
              <p class="body">{{ displayContent(selected.summaryContent) }}</p>
            </section>

            <section class="block ai-block">
              <div class="ai-header">
                <h3 class="hint">AI 主管建議</h3>
                <button
                  type="button"
                  class="btn-ai"
                  :disabled="store.aiAdviceLoading"
                  @click="requestAiAdvice"
                >
                  <template v-if="store.aiAdviceLoading">
                    產生中<span class="loading-dots" aria-hidden="true"
                      ><i></i><i></i><i></i
                    ></span>
                  </template>
                  <template v-else>
                    {{
                      selected.aiManagerAdvice
                        ? '重新產生'
                        : '產生 AI 主管建議'
                    }}
                  </template>
                </button>
              </div>
              <p v-if="selected.aiGeneratedAt" class="ai-meta">
                產生於 {{ formatDateTime(selected.aiGeneratedAt) }}
              </p>
              <p v-if="aiError" class="ai-error">{{ aiError }}</p>
              <p v-if="store.aiAdviceLoading" class="ai-loading">
                AI 主管正在整理建議<span class="loading-dots" aria-hidden="true"
                  ><i></i><i></i><i></i
                ></span>
              </p>
              <div
                v-else-if="selected.aiManagerAdvice"
                class="body ai-body markdown-body"
                v-html="renderedAiAdvice"
              />
              <p v-else class="ai-empty">
                尚未產生建議。點擊上方按鈕前會先確認 API 呼叫用量。
              </p>
            </section>
          </article>
        </div>

        <Transition name="fade">
          <button
            v-if="showBackToTop"
            type="button"
            class="back-to-top"
            aria-label="回到最上方"
            @click="scrollDetailToTop"
          >
            <AppIcon name="arrow-up" size="sm" />
          </button>
        </Transition>
      </section>
    </div>

    <div v-else class="empty">
      <p>
        尚無回顧紀錄。於今日任務頁新增並儲存日誌後，當日內容會顯示於此，可直接呼叫 AI 主管。
      </p>
    </div>

    <ConfirmDialog
      :visible="confirmVisible"
      title="刪除回顧"
      message="確定刪除這一天的回顧日誌？此操作無法復原。"
      confirm-label="刪除"
      cancel-label="取消"
      danger
      @confirm="confirmDelete"
      @close="confirmVisible = false"
    />

    <ConfirmDialog
      :visible="aiConfirmVisible"
      title="確認呼叫 Gemini API"
      :message="aiConfirmMessage"
      confirm-label="確認呼叫"
      cancel-label="取消"
      @confirm="confirmAiAdvice"
      @close="aiConfirmVisible = false"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.page-header {
  margin-bottom: 24px;

  h1 {
    font-size: 24px;
    font-weight: 700;
  }
}

.subtitle {
  color: $text-muted;
  font-size: 13px;
  margin-top: 4px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) 1fr;
  gap: 20px;
  align-items: start;
  min-height: 420px;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 180px);
  overflow-y: auto;
  padding-right: 4px;
}

.date-item {
  text-align: left;
  padding: 12px 14px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $surface;
  transition: all 0.15s;

  &:hover {
    border-color: $primary;
    background: $primary-light;
  }

  &.active {
    border-color: $primary;
    background: $primary-light;
    box-shadow: 0 0 0 2px rgba($primary, 0.15);
  }
}

.date-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-label {
  font-size: 14px;
  font-weight: 600;
  color: $text;
}

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  line-height: 1.4;

  &.draft {
    color: #b45309;
    background: rgba(#f59e0b, 0.15);
  }

  &.today {
    color: $primary;
    background: $primary-light;
  }
}

.date-preview {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: $text-muted;
  line-height: 1.4;
}

.detail {
  position: relative;
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow;
  min-height: 360px;
  max-height: calc(100vh - 180px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
  scrollbar-gutter: stable;
}

.back-to-top {
  position: absolute;
  right: 20px;
  bottom: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: $primary;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-lg;
  z-index: 5;

  &:hover {
    background: $primary-dark;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid $border;

  h2 {
    font-size: 20px;
    font-weight: 700;
  }
}

.detail-meta {
  margin-top: 4px;
  font-size: 13px;
  color: $text-muted;
}

.detail-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.edit,
.delete {
  color: $text-muted;
  padding: 6px;
  border-radius: $radius-sm;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }
}

.edit:hover {
  color: $primary;
}

.delete:hover {
  color: #ef4444;
  background: rgba(#ef4444, 0.1);
}

.report {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hint {
  color: #888888;
  font-size: 0.85rem;
  font-weight: 500;
}

.body {
  font-size: 14px;
  line-height: 1.7;
  color: $text;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-block {
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px dashed $border;
}

.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-ai {
  padding: 6px 12px;
  background: $primary;
  color: white;
  border-radius: $radius-sm;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: $primary-dark;
  }

  &:disabled {
    opacity: 0.65;
    cursor: default;
  }
}

.ai-meta {
  font-size: 12px;
  color: $text-muted;
}

.ai-error {
  font-size: 13px;
  color: #ef4444;
  line-height: 1.5;
}

.ai-empty {
  font-size: 13px;
  color: $text-muted;
}

.ai-loading {
  font-size: 13px;
  color: $text-muted;
}

.loading-dots {
  display: inline-flex;
  align-items: flex-end;
  gap: 3px;
  margin-left: 4px;

  i {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    animation: dot-bounce 1.2s ease-in-out infinite;

    &:nth-child(2) {
      animation-delay: 0.15s;
    }

    &:nth-child(3) {
      animation-delay: 0.3s;
    }
  }
}

@keyframes dot-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }

  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.ai-body {
  padding: 12px;
  background: $bg;
  border-radius: $radius-sm;
  border: 1px solid $border;
}

.markdown-body {
  white-space: normal;

  :deep(h1),
  :deep(h2),
  :deep(h3) {
    margin: 16px 0 8px;
    color: $text;
    line-height: 1.4;

    &:first-child {
      margin-top: 0;
    }
  }

  :deep(h1) {
    font-size: 20px;
  }

  :deep(h2) {
    font-size: 17px;
  }

  :deep(h3) {
    font-size: 15px;
  }

  :deep(p) {
    margin: 8px 0;
  }

  :deep(ul),
  :deep(ol) {
    margin: 8px 0;
    padding-left: 24px;
  }

  :deep(li) {
    margin: 5px 0;
  }

  :deep(strong) {
    font-weight: 700;
  }

  :deep(blockquote) {
    margin: 10px 0;
    padding-left: 12px;
    border-left: 3px solid $primary;
    color: $text-muted;
  }

  :deep(code) {
    padding: 2px 5px;
    border-radius: 4px;
    background: rgba($primary, 0.1);
    font-family: monospace;
  }
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: $text-muted;
  font-size: 14px;
}

@media (max-width: $breakpoint-md) {
  .layout {
    grid-template-columns: 1fr;
  }

  .timeline {
    max-height: none;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 4px;
  }

  .date-item {
    min-width: 180px;
    flex-shrink: 0;
  }

  .detail-scroll {
    padding: 18px;
  }
}
</style>
