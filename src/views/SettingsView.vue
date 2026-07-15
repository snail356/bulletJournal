<script setup lang="ts">
import { computed, ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useTaskStore } from '@/stores/taskStore'
import { mockLabels, mockTasks } from '@/mock/data'
import { TASKS_KEY, LABELS_KEY, SELECTED_DATE_KEY, saveToStorage } from '@/utils/storage'
import { todayString } from '@/utils/date'
import { getGeminiModel, hasGeminiApiKey } from '@/utils/gemini'

const store = useTaskStore()
const message = ref('')
const aiPromptDraft = ref(store.aiManagerPrompt)
const aiPromptMessage = ref('')
const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmDanger = ref(false)
const confirmLabel = ref('確定')
let confirmAction: (() => void) | null = null

const geminiKeyConfigured = computed(() => hasGeminiApiKey())
const geminiLastCalled = computed(() => {
  const iso = store.geminiUsage.lastCalledAt
  if (!iso) return '尚無'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-TW')
})

function openConfirm(
  title: string,
  msg: string,
  action: () => void,
  options?: { danger?: boolean; confirmLabel?: string },
) {
  confirmTitle.value = title
  confirmMessage.value = msg
  confirmDanger.value = options?.danger ?? false
  confirmLabel.value = options?.confirmLabel ?? '確定'
  confirmAction = action
  confirmVisible.value = true
}

function onConfirm() {
  confirmAction?.()
}

function resetMockData() {
  openConfirm(
    '重置為 Mock 資料',
    '確定要重置為 mock 假資料？所有變更將遺失。',
    () => {
      store.tasks = [...mockTasks]
      store.labels = [...mockLabels]
      store.setSelectedDate(todayString())
      saveToStorage(TASKS_KEY, store.tasks)
      saveToStorage(LABELS_KEY, store.labels)
      saveToStorage(SELECTED_DATE_KEY, store.selectedDate)
      message.value = '已重置為 mock 資料'
      setTimeout(() => (message.value = ''), 3000)
    },
  )
}

function clearAllData() {
  openConfirm(
    '清除所有資料',
    '確定要清除所有任務、標籤與偏好設定？此操作無法復原，且不會還原為示範資料。',
    () => {
      store.clearAllData()
      message.value = '已清除所有資料'
      setTimeout(() => (message.value = ''), 3000)
    },
    { danger: true, confirmLabel: '全部清除' },
  )
}

function saveAiManagerPrompt() {
  store.setAiManagerPrompt(aiPromptDraft.value)
  aiPromptDraft.value = store.aiManagerPrompt
  aiPromptMessage.value = store.aiManagerPrompt
    ? 'AI 主管 Prompt 已儲存'
    : '已清除自訂 Prompt，將使用系統預設設定'
  setTimeout(() => (aiPromptMessage.value = ''), 3000)
}
</script>

<template>
  <div class="settings-view">
    <header class="page-header">
      <h1>設定</h1>
      <p class="subtitle">應用程式偏好與資料管理</p>
    </header>

    <div class="settings-card">
      <h2>資料管理</h2>
      <p class="desc">所有資料儲存於瀏覽器 localStorage，無需後端。</p>
      <div class="actions">
        <button type="button" class="btn-secondary" @click="resetMockData">
          重置為 Mock 資料
        </button>
        <button type="button" class="btn-danger" @click="clearAllData">
          清除所有資料
        </button>
      </div>
      <p v-if="message" class="feedback">{{ message }}</p>
    </div>

    <div class="settings-card">
      <h2>AI 主管 Prompt</h2>
      <p class="desc">
        可加入角色、語氣或分析重點等自訂指示。呼叫 Gemini API 時，此內容會加在系統預設 Prompt 之前；留空則只使用預設設定。
      </p>
      <label class="prompt-field">
        <span>自訂 Prompt</span>
        <textarea
          v-model="aiPromptDraft"
          rows="7"
          maxlength="4000"
          placeholder="例如：請特別分析時間分配，並以直接、精簡的語氣提出明日最重要的三項行動。"
        />
      </label>
      <div class="prompt-footer">
        <span class="character-count">{{ aiPromptDraft.length }} / 4000</span>
        <button type="button" class="btn-primary" @click="saveAiManagerPrompt">
          儲存 Prompt
        </button>
      </div>
      <p v-if="aiPromptMessage" class="feedback">{{ aiPromptMessage }}</p>
    </div>

    <div class="settings-card">
      <h2>Gemini 本機呼叫用量</h2>
      <p class="desc">
        AI 主管建議使用環境變數中的 API Key。此處顯示本機累計成功呼叫次數（非 Google 帳單）。
        詳見 <code>docs/ai-manager-advice.md</code>。
      </p>
      <ul class="info">
        <li>API Key：{{ geminiKeyConfigured ? '已設定（環境變數）' : '未設定' }}</li>
        <li>模型：{{ getGeminiModel() }}</li>
        <li>累計成功呼叫：{{ store.geminiUsage.totalSuccessCalls }} 次</li>
        <li>最後呼叫：{{ geminiLastCalled }}</li>
        <li v-if="store.geminiUsage.lastError">
          最近錯誤：{{ store.geminiUsage.lastError }}
        </li>
      </ul>
    </div>

    <div class="settings-card">
      <h2>關於</h2>
      <p class="desc">Bullet Journal 工作狀態紀錄 Web App</p>
      <ul class="info">
        <li>Vue 3 + Vite + TypeScript</li>
        <li>Pinia + Vue Router</li>
        <li>版本 1.0.0</li>
      </ul>
    </div>

    <ConfirmDialog
      :visible="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      :danger="confirmDanger"
      :confirm-label="confirmLabel"
      cancel-label="取消"
      @confirm="onConfirm"
      @close="confirmVisible = false"
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

.settings-card {
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow;
  padding: 24px;
  margin-bottom: 16px;

  h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
  }
}

.desc {
  color: $text-muted;
  font-size: 13px;
  margin-bottom: 16px;
  line-height: 1.5;

  code {
    font-size: 12px;
    background: $bg;
    padding: 1px 6px;
    border-radius: 4px;
  }
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.prompt-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: $text;

  textarea {
    width: 100%;
    min-height: 140px;
    padding: 12px;
    border: 1px solid $border;
    border-radius: $radius-sm;
    background: $bg;
    color: $text;
    font: inherit;
    line-height: 1.6;
    resize: vertical;
    outline: none;

    &:focus {
      border-color: $primary;
      box-shadow: 0 0 0 2px rgba($primary, 0.12);
    }
  }
}

.prompt-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}

.character-count {
  color: $text-muted;
  font-size: 12px;
}

.btn-primary {
  padding: 8px 16px;
  border-radius: $radius-sm;
  background: $primary;
  color: white;
  font-weight: 500;

  &:hover {
    background: $primary-dark;
  }
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  color: $text;

  &:hover {
    border-color: $primary;
    color: $primary;
  }
}

.btn-danger {
  padding: 8px 16px;
  background: #fef2f2;
  color: #ef4444;
  border-radius: $radius-sm;
  font-weight: 500;

  &:hover {
    background: #fee2e2;
  }
}

.feedback {
  margin-top: 12px;
  color: #22c55e;
  font-size: 13px;
}

.info {
  font-size: 13px;
  color: $text-muted;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
