<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import AppSwitch from '@/components/AppSwitch.vue'
import AppIcon from '@/components/AppIcon.vue'
import AppTabs, { type AppTabItem } from '@/components/AppTabs.vue'
import LabelsManager from '@/components/LabelsManager.vue'
import SidebarCarouselManager from '@/components/SidebarCarouselManager.vue'
import TaskAvatarsManager from '@/components/TaskAvatarsManager.vue'
import { useTaskStore } from '@/stores/taskStore'
import { useStockStore } from '@/stores/stockStore'
import { mockLabels, mockTasks } from '@/mock/data'
import { importBackupZip } from '@/utils/backupImport'
import {
  chooseBackupFolder,
  clearBackupFolder,
  executeBackup,
  isDirectoryPickerSupported,
  maybeRunAutoBackup,
  syncBackupFolderState,
} from '@/utils/runBackup'
import {
  formatLastDownloadedAt,
  loadBackupPrefs,
  MONTH_DAY_OPTIONS,
  updateBackupPrefs,
  WEEKDAY_OPTIONS,
  type BackupFrequency,
  type BackupPrefs,
} from '@/utils/backupPrefs'
import { TASKS_KEY, LABELS_KEY, SELECTED_DATE_KEY, saveToStorage } from '@/utils/storage'
import { todayString } from '@/utils/date'
import { getGeminiModel, hasGeminiApiKey } from '@/utils/gemini'
import { useSimpleReorderDrag } from '@/composables/useReorderDrag'
import { type NavFeatureId } from '@/utils/navFeatures'

const store = useTaskStore()
const stockStore = useStockStore()
const { draggingId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd } =
  useSimpleReorderDrag(
    () => store.orderedNavFeatures,
    (fromId, toId) => store.reorderNavFeatures(fromId, toId),
  )
const message = ref('')
const messageError = ref(false)
const exporting = ref(false)
const importing = ref(false)
const importInput = ref<HTMLInputElement | null>(null)
const busy = computed(() => exporting.value || importing.value)
const backupPrefs = ref<BackupPrefs>(loadBackupPrefs())
const folderPicking = ref(false)
const directoryPickerSupported = isDirectoryPickerSupported()
const lastDownloadLabel = computed(() =>
  formatLastDownloadedAt(backupPrefs.value.lastDownloadedAt),
)
const folderLabel = computed(() =>
  backupPrefs.value.folderName
    ? backupPrefs.value.folderName
    : '系統預設下載資料夾',
)
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
      showFeedback('已重置為 mock 資料')
    },
  )
}

function clearAllData() {
  openConfirm(
    '清除所有資料',
    '確定要清除所有任務、標籤與偏好設定？此操作無法復原，且不會還原為示範資料。',
    () => {
      store.clearAllData()
      stockStore.clearAll()
      showFeedback('已清除所有資料')
    },
    { danger: true, confirmLabel: '全部清除' },
  )
}

function showFeedback(text: string, error = false) {
  message.value = text
  messageError.value = error
  setTimeout(() => {
    if (message.value === text) {
      message.value = ''
      messageError.value = false
    }
  }, error ? 5000 : 3000)
}

async function backupData() {
  if (busy.value) return
  exporting.value = true
  message.value = ''
  messageError.value = false
  try {
    const result = await executeBackup({ interactive: true })
    backupPrefs.value = loadBackupPrefs()
    const where = result.savedToFolder
      ? `已儲存至「${backupPrefs.value.folderName || '指定資料夾'}」`
      : '已下載'
    showFeedback(
      `${where} ${result.fileName}（任務 ${result.taskCount}、標籤 ${result.labelCount}、狀態 ${result.statusCount}、清單 ${result.toolboxCount}、日誌 ${result.reflectionCount}、照片 ${result.photoCount}）`,
    )
  } catch (err) {
    const reason = err instanceof Error && err.message ? err.message : '請稍後再試'
    showFeedback(`備份失敗：${reason}`, true)
  } finally {
    exporting.value = false
  }
}

function patchBackupPrefs(patch: Partial<BackupPrefs>) {
  backupPrefs.value = updateBackupPrefs(patch)
}

async function tryAutoBackupNow(successMessage = '已依排程自動備份') {
  if (!backupPrefs.value.autoEnabled) return
  try {
    const ran = await maybeRunAutoBackup()
    backupPrefs.value = loadBackupPrefs()
    if (ran) showFeedback(successMessage)
  } catch (err) {
    const reason = err instanceof Error && err.message ? err.message : '請稍後再試'
    showFeedback(`自動備份失敗：${reason}`, true)
  }
}

function setAutoBackup(enabled: boolean) {
  patchBackupPrefs({ autoEnabled: enabled })
}

function setBackupFrequency(frequency: BackupFrequency) {
  patchBackupPrefs({ frequency })
  void tryAutoBackupNow()
}

function setWeeklyDay(day: number) {
  patchBackupPrefs({ weeklyDay: day })
  void tryAutoBackupNow()
}

function setMonthlyDate(day: number) {
  patchBackupPrefs({ monthlyDate: day })
  void tryAutoBackupNow()
}

async function onChooseFolder() {
  if (busy.value || folderPicking.value) return
  folderPicking.value = true
  try {
    const name = await chooseBackupFolder()
    backupPrefs.value = loadBackupPrefs()
    showFeedback(`已選擇資料夾「${name}」`)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    const reason = err instanceof Error && err.message ? err.message : '請稍後再試'
    showFeedback(`選擇資料夾失敗：${reason}`, true)
  } finally {
    folderPicking.value = false
  }
}

async function onClearFolder() {
  await clearBackupFolder()
  backupPrefs.value = loadBackupPrefs()
  showFeedback('已改回系統預設下載資料夾')
}

function chooseImportFile() {
  if (busy.value) return
  importInput.value?.click()
}

function onImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  openConfirm(
    '匯入備份',
    `將匯入「${file.name}」中尚未存在的任務、標籤、狀態標籤、工具箱、回顧日誌、頭像、側邊圖片與自選股。已存在的項目會跳過，不會覆蓋或重複新增。`,
    () => {
      void runImport(file)
    },
    { confirmLabel: '確定匯入' },
  )
}

async function runImport(file: File) {
  if (busy.value) return
  importing.value = true
  message.value = ''
  messageError.value = false
  try {
    const source = await importBackupZip(file)
    const summary = store.mergeImportedBackup(source)
    const stocks = stockStore.mergeFavorites(source.stockFavorites ?? [])
    const added =
      summary.tasksAdded +
      summary.labelsAdded +
      summary.statusAdded +
      summary.toolboxListsAdded +
      summary.toolboxItemsAdded +
      summary.reflectionsAdded +
      summary.avatarsAdded +
      summary.avatarsUpdated +
      summary.carouselAdded +
      stocks.added +
      (summary.aiPromptRestored ? 1 : 0)
    if (!added) {
      showFeedback('沒有新增資料，備份中的項目都已存在')
    } else {
      showFeedback(
        `已匯入：任務 ${summary.tasksAdded}、標籤 ${summary.labelsAdded}、狀態 ${summary.statusAdded}、清單 ${summary.toolboxListsAdded}、日誌 ${summary.reflectionsAdded}、頭像 ${summary.avatarsAdded + summary.avatarsUpdated}、側邊圖 ${summary.carouselAdded}、自選股 ${stocks.added}`,
      )
    }
  } catch (err) {
    const reason = err instanceof Error && err.message ? err.message : '請稍後再試'
    showFeedback(`匯入失敗：${reason}`, true)
  } finally {
    importing.value = false
  }
}

function saveAiManagerPrompt() {
  store.setAiManagerPrompt(aiPromptDraft.value)
  aiPromptDraft.value = store.aiManagerPrompt
  aiPromptMessage.value = store.aiManagerPrompt
    ? 'AI 主管 Prompt 已儲存'
    : '已清除自訂 Prompt，將使用系統預設設定'
  setTimeout(() => (aiPromptMessage.value = ''), 3000)
}

function toggleNavFeature(id: NavFeatureId, enabled: boolean) {
  store.setNavFeatureEnabled(id, enabled)
}

const activeTab = ref('features')
const settingsTabs: AppTabItem[] = [
  { id: 'features', label: '功能頁面', icon: 'list-check' },
  { id: 'labels', label: '標籤管理', icon: 'tags' },
  { id: 'avatars', label: '任務頭像', icon: 'user' },
  { id: 'carousel', label: '側邊圖片', icon: 'image' },
  { id: 'data', label: '資料管理', icon: 'copy' },
  { id: 'ai', label: 'AI 設定', icon: 'file-lines' },
  { id: 'about', label: '關於', icon: 'book' },
]
const settingsTabIds = new Set(settingsTabs.map((tab) => tab.id))
const route = useRoute()
const router = useRouter()

function tabFromQuery(): string {
  const tab = route.query.tab
  return typeof tab === 'string' && settingsTabIds.has(tab) ? tab : 'features'
}

activeTab.value = tabFromQuery()

watch(activeTab, (tab) => {
  const current = typeof route.query.tab === 'string' ? route.query.tab : 'features'
  if (current === tab) return
  void router.replace({
    query: tab === 'features' ? { ...route.query, tab: undefined } : { ...route.query, tab },
  })
})

watch(
  () => route.query.tab,
  () => {
    const next = tabFromQuery()
    if (activeTab.value !== next) activeTab.value = next
  },
)

onMounted(() => {
  void syncBackupFolderState().then(() => {
    backupPrefs.value = loadBackupPrefs()
  })
})
</script>

<template>
  <div class="settings-view">
    <header class="page-header">
      <h1>設定</h1>
      <p class="subtitle">應用程式偏好與資料管理</p>
    </header>

    <AppTabs v-model="activeTab" :tabs="settingsTabs" aria-label="設定分類">
      <template #features>
        <div class="settings-card">
          <h2>功能頁面</h2>
          <p class="desc">
            選擇左側選單要顯示的功能，拖曳左側把手可調整選單順序。關閉後該頁面不會出現在選單中，直接開啟連結也會改到仍開啟的頁面。設定無法關閉，以便隨時再調整。
          </p>
          <ul class="feature-list">
            <li
              v-for="feature in store.orderedNavFeatures"
              :key="feature.id"
              class="feature-row"
              :class="{
                dragging: draggingId === feature.id,
                'drag-over': dragOverId === feature.id,
              }"
              @dragover="onDragOver($event, feature.id)"
              @drop="onDrop($event, feature.id)"
            >
              <span
                class="drag-handle"
                draggable="true"
                aria-label="拖曳排序"
                @dragstart="onDragStart($event, feature.id)"
                @dragend="onDragEnd"
              >
                <AppIcon name="grip-vertical" />
              </span>
              <span class="feature-icon">
                <AppIcon :name="feature.icon" />
              </span>
              <div class="feature-copy">
                <span class="feature-name">{{ feature.label }}</span>
                <span class="feature-desc">
                  {{ feature.alwaysEnabled ? '無法關閉，以便隨時調整其他功能' : feature.description }}
                </span>
              </div>
              <AppSwitch
                :model-value="store.isNavFeatureEnabled(feature.id)"
                :disabled="feature.alwaysEnabled"
                @update:model-value="toggleNavFeature(feature.id, $event)"
              />
            </li>
          </ul>
        </div>
      </template>

      <template #labels>
        <LabelsManager />
      </template>

      <template #avatars>
        <div class="settings-card">
          <h2>任務頭像</h2>
          <TaskAvatarsManager />
        </div>
      </template>

      <template #carousel>
        <div class="settings-card">
          <h2>側邊圖片輪播</h2>
          <SidebarCarouselManager />
        </div>
      </template>

      <template #data>
        <div class="settings-card">
          <h2>資料管理</h2>
          <p class="desc">
            所有資料儲存於瀏覽器 localStorage，無需後端。可備份或匯入任務、標籤管理（任務標籤與狀態標籤）、工具箱、回顧日誌、任務頭像、側邊圖片與自選股。
          </p>
          <div class="actions">
            <button
              type="button"
              class="btn-primary"
              :disabled="busy"
              @click="backupData"
            >
              {{ exporting ? '備份中…' : '備份資料' }}
            </button>
            <button
              type="button"
              class="btn-secondary"
              :disabled="busy"
              @click="chooseImportFile"
            >
              {{ importing ? '匯入中…' : '匯入備份' }}
            </button>
            <button type="button" class="btn-secondary" :disabled="busy" @click="resetMockData">
              重置為 Mock 資料
            </button>
            <button type="button" class="btn-danger" :disabled="busy" @click="clearAllData">
              清除所有資料
            </button>
          </div>
          <input
            ref="importInput"
            class="file-input"
            type="file"
            accept=".zip,application/zip"
            @change="onImportFileChange"
          />
          <p v-if="message" class="feedback" :class="{ error: messageError }">{{ message }}</p>

          <div class="backup-settings">
            <div class="backup-row">
              <div class="backup-copy">
                <span class="backup-label">下載資料夾</span>
                <span class="backup-meta">目前：{{ folderLabel }}</span>
              </div>
              <div class="backup-controls">
                <button
                  v-if="directoryPickerSupported"
                  type="button"
                  class="btn-secondary"
                  :disabled="busy || folderPicking"
                  @click="onChooseFolder"
                >
                  {{ backupPrefs.folderName ? '改選資料夾' : '選擇資料夾' }}
                </button>
                <button
                  v-if="directoryPickerSupported && backupPrefs.folderName"
                  type="button"
                  class="btn-secondary"
                  :disabled="busy || folderPicking"
                  @click="onClearFolder"
                >
                  改回預設
                </button>
              </div>
            </div>
            <p v-if="!directoryPickerSupported" class="backup-hint">
              此瀏覽器不支援指定資料夾，備份會存到系統預設下載位置。
            </p>
            <p v-else class="backup-hint">
              未選擇時維持系統預設下載資料夾。自動備份建議先指定資料夾，才能在背景寫入、較不受瀏覽器攔截下載限制。
            </p>

            <div class="backup-row">
              <div class="backup-copy">
                <span class="backup-label">自動備份</span>
                <span class="backup-meta">到期時自動觸發備份；手動或自動下載都會更新下方日期</span>
              </div>
              <AppSwitch
                :model-value="backupPrefs.autoEnabled"
                :disabled="busy"
                @update:model-value="setAutoBackup"
              />
            </div>

            <div class="backup-row schedule" :class="{ disabled: !backupPrefs.autoEnabled }">
              <div class="backup-copy">
                <span class="backup-label">自動下載週期</span>
              </div>
              <div class="backup-controls schedule-controls">
                <label class="freq-option" :class="{ active: backupPrefs.frequency === 'weekly' }">
                  <input
                    type="radio"
                    name="backup-frequency"
                    value="weekly"
                    :checked="backupPrefs.frequency === 'weekly'"
                    :disabled="!backupPrefs.autoEnabled || busy"
                    @change="setBackupFrequency('weekly')"
                  />
                  每周
                </label>
                <select
                  :value="backupPrefs.weeklyDay"
                  :disabled="!backupPrefs.autoEnabled || backupPrefs.frequency !== 'weekly' || busy"
                  @change="setWeeklyDay(Number(($event.target as HTMLSelectElement).value))"
                >
                  <option v-for="day in WEEKDAY_OPTIONS" :key="day.value" :value="day.value">
                    {{ day.label }}
                  </option>
                </select>
                <label class="freq-option" :class="{ active: backupPrefs.frequency === 'monthly' }">
                  <input
                    type="radio"
                    name="backup-frequency"
                    value="monthly"
                    :checked="backupPrefs.frequency === 'monthly'"
                    :disabled="!backupPrefs.autoEnabled || busy"
                    @change="setBackupFrequency('monthly')"
                  />
                  每月
                </label>
                <select
                  :value="backupPrefs.monthlyDate"
                  :disabled="!backupPrefs.autoEnabled || backupPrefs.frequency !== 'monthly' || busy"
                  @change="setMonthlyDate(Number(($event.target as HTMLSelectElement).value))"
                >
                  <option v-for="day in MONTH_DAY_OPTIONS" :key="day" :value="day">
                    {{ day }} 日
                  </option>
                </select>
              </div>
            </div>

            <div class="backup-row">
              <div class="backup-copy">
                <span class="backup-label">最新下載日期</span>
                <span class="backup-meta">{{ lastDownloadLabel }}</span>
              </div>
            </div>
          </div>

          <div class="usage">
            <h3>使用說明</h3>
            <ul>
              <li>
                <strong>備份資料</strong>：下載 ZIP。內含可閱讀的 Markdown、外置 WebP 照片，以及供還原用的
                <code>data.json</code>（含標籤管理、回顧日誌、頭像、側邊圖片與自選股）。
              </li>
              <li>
                <strong>匯入備份</strong>：選擇先前下載的 ZIP。只會新增目前沒有的項目，已存在的不會覆蓋、也不會重複。
              </li>
              <li>
                判斷已存在：任務比對「同一筆 id」或「同一天相同標題」；任務標籤與狀態標籤比對名稱；思考清單比對標題；回顧日誌比對日期；自選股比對代碼。
              </li>
              <li>
                自動備份會在開啟應用程式時檢查是否到期。若該週／該月已手動或自動下載過，則不會重複備份。
              </li>
            </ul>
          </div>
        </div>
      </template>

      <template #ai>
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
      </template>

      <template #about>
        <div class="settings-card">
          <h2>關於</h2>
          <p class="desc">Bullet Journal 工作狀態紀錄 Web App</p>
          <ul class="info">
            <li>Vue 3 + Vite + TypeScript</li>
            <li>Pinia + Vue Router</li>
            <li>版本 1.0.0</li>
          </ul>
        </div>
      </template>
    </AppTabs>

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

.backup-settings {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid $border;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.backup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;

  &.schedule {
    align-items: flex-start;
  }

  &.disabled {
    opacity: 0.55;
  }
}

.backup-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.backup-label {
  font-size: 14px;
  font-weight: 600;
  color: $text;
}

.backup-meta {
  font-size: 12px;
  color: $text-muted;
  line-height: 1.4;
}

.backup-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.schedule-controls {
  max-width: 100%;
}

.backup-hint {
  color: $text-muted;
  font-size: 12px;
  line-height: 1.5;
  margin-top: -6px;
}

.freq-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: $text;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: $radius-sm;
  border: 1px solid transparent;

  &.active {
    background: $primary-light;
    color: $primary-dark;
  }

  input {
    accent-color: $primary;
  }
}

.backup-settings select {
  padding: 6px 10px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $bg;
  color: $text;
  outline: none;

  &:focus {
    border-color: $primary;
    box-shadow: 0 0 0 2px rgba($primary, 0.12);
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
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

  &:hover:not(:disabled) {
    background: $primary-dark;
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  color: $text;

  &:hover:not(:disabled) {
    border-color: $primary;
    color: $primary;
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
}

.btn-danger {
  padding: 8px 16px;
  background: #fef2f2;
  color: #ef4444;
  border-radius: $radius-sm;
  font-weight: 500;

  &:hover:not(:disabled) {
    background: #fee2e2;
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
}

.file-input {
  display: none;
}

.usage {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid $border;

  h3 {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  ul {
    color: $text-muted;
    font-size: 13px;
    line-height: 1.6;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  strong {
    color: $text;
    font-weight: 600;
  }

  code {
    font-size: 12px;
    background: $bg;
    padding: 1px 6px;
    border-radius: 4px;
  }
}

.feedback {
  margin-top: 12px;
  color: #22c55e;
  font-size: 13px;

  &.error {
    color: #ef4444;
  }
}

.info {
  font-size: 13px;
  color: $text-muted;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.feature-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  border-radius: $radius-sm;
  transition: opacity 0.15s, box-shadow 0.15s;

  &:hover {
    background: $bg;
  }

  &.dragging {
    opacity: 0.45;
  }

  &.drag-over {
    box-shadow: inset 0 -2px 0 $primary;
  }
}

.drag-handle {
  color: $text-muted;
  font-size: 14px;
  cursor: grab;
  opacity: 0.4;
  line-height: 1;
  flex-shrink: 0;

  &:hover {
    opacity: 0.8;
  }

  &:active {
    cursor: grabbing;
  }
}

.feature-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: $primary-light;
  color: $primary;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feature-name {
  font-size: 14px;
  font-weight: 600;
  color: $text;
}

.feature-desc {
  font-size: 12px;
  color: $text-muted;
  line-height: 1.4;
}
</style>
