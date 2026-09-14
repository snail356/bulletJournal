<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppSwitch from '@/components/AppSwitch.vue'
import { useTaskStore } from '@/stores/taskStore'
import {
  clearBacklogPrefs,
  fetchBacklogMyself,
  formatBacklogError,
  hasBacklogCredentials,
  loadBacklogPrefs,
  saveBacklogPrefs,
} from '@/utils/backlog'
import { parseSpaceUrl } from '@/utils/backlogHost'

const store = useTaskStore()
const router = useRouter()
const spaceUrl = ref(loadBacklogPrefs().spaceUrl)
const apiKey = ref(loadBacklogPrefs().apiKey)
const saving = ref(false)
const testing = ref(false)
const message = ref('')
const messageError = ref(false)

const canSave = computed(() => {
  const space = parseSpaceUrl(spaceUrl.value)
  return Boolean(space && apiKey.value.trim())
})

function showMessage(text: string, isError = false) {
  message.value = text
  messageError.value = isError
}

function save(): boolean {
  const space = parseSpaceUrl(spaceUrl.value)
  if (!space) {
    showMessage('請輸入有效的 Space 網址，例如 https://your-space.backlog.com', true)
    return false
  }
  if (!apiKey.value.trim()) {
    showMessage('請輸入 API Key', true)
    return false
  }
  saving.value = true
  saveBacklogPrefs({ spaceUrl: space.origin, apiKey: apiKey.value })
  spaceUrl.value = space.origin
  store.setNavFeatureEnabled('backlog', true)
  showMessage('已儲存連線設定，側邊欄已出現 Backlog 匯入頁')
  saving.value = false
  return true
}

function openImportPage() {
  if (!hasBacklogCredentials()) {
    if (!save()) {
      showMessage('請先填寫並儲存 Space 與 API Key', true)
      return
    }
  } else if (canSave.value) {
    save()
  }
  store.setNavFeatureEnabled('backlog', true)
  void router.push('/backlog')
}

async function testConnection() {
  if (!save()) return
  testing.value = true
  try {
    const me = await fetchBacklogMyself()
    showMessage(`連線成功：${me.name}`)
  } catch (error) {
    showMessage(formatBacklogError(error), true)
  } finally {
    testing.value = false
  }
}

function clear() {
  clearBacklogPrefs()
  spaceUrl.value = ''
  apiKey.value = ''
  showMessage('已清除 Backlog 憑證')
}
</script>

<template>
  <div class="backlog-settings">
    <p class="desc">
      Space 與 API Key 只存在本機瀏覽器，不會寫入備份 ZIP，也不會上傳。請在 Backlog「個人設定 → API」發行金鑰。GitHub Pages 靜態站因 CORS 無法直連，需以本機
      <code>npm run dev</code> 使用。
    </p>
    <label class="field">
      <span>Space URL</span>
      <input
        v-model="spaceUrl"
        type="text"
        autocomplete="off"
        spellcheck="false"
        placeholder="https://your-space.backlog.com"
      />
    </label>
    <label class="field">
      <span>API Key</span>
      <input
        v-model="apiKey"
        type="password"
        autocomplete="off"
        spellcheck="false"
        placeholder="貼上 Backlog API Key"
      />
    </label>
    <div class="enable-row">
      <AppSwitch
        :model-value="store.isNavFeatureEnabled('backlog')"
        label="在側邊欄顯示 Backlog 匯入頁"
        @update:model-value="store.setNavFeatureEnabled('backlog', $event)"
      />
    </div>
    <div class="actions">
      <button type="button" class="btn-primary" :disabled="!canSave || saving || testing" @click="save">
        儲存
      </button>
      <button type="button" class="btn-secondary" :disabled="!canSave || testing" @click="testConnection">
        {{ testing ? '測試中…' : '測試連線' }}
      </button>
      <button type="button" class="btn-secondary" :disabled="testing" @click="clear">清除憑證</button>
    </div>
    <p v-if="message" class="feedback" :class="{ error: messageError }">{{ message }}</p>
    <button
      type="button"
      class="btn-primary import-btn"
      :disabled="testing"
      @click="openImportPage"
    >
      選擇 BK 任務並匯入
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

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

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: $text;
  margin-bottom: 12px;

  input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid $border;
    border-radius: $radius-sm;
    background: $bg;
    color: $text;
    font: inherit;
    outline: none;

    &:focus {
      border-color: $primary;
      box-shadow: 0 0 0 2px rgba($primary, 0.12);
    }
  }
}

.enable-row {
  margin: 4px 0 14px;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.import-btn {
  margin-top: 16px;
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

.feedback {
  margin-top: 12px;
  font-size: 13px;
  color: $primary;

  &.error {
    color: #ef4444;
  }
}
</style>
