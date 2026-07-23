<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import InlineEditable from '@/components/InlineEditable.vue'
import ToolboxItemBlock from '@/components/ToolboxItemBlock.vue'
import { useTaskStore } from '@/stores/taskStore'
import type { ToolboxList } from '@/types'

const store = useTaskStore()
const selectedId = ref<string | null>(null)
const keyword = ref('')
const confirmVisible = ref(false)
const pendingDelete = ref<ToolboxList | null>(null)
const pendingFocusItemId = ref<string | null>(null)

const lists = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  const all = store.toolboxListsSorted
  if (!query) return all
  return all.filter((list) => {
    const haystack = [
      list.title,
      list.purpose,
      ...list.items.map((item) => item.content),
    ]
      .join('\n')
      .toLowerCase()
    return haystack.includes(query)
  })
})

const selected = computed(() => {
  if (!selectedId.value) return null
  return store.toolboxLists.find((list) => list.id === selectedId.value) ?? null
})

watch(
  lists,
  (list) => {
    if (!list.length) {
      selectedId.value = null
      return
    }
    const stillValid = list.some((item) => item.id === selectedId.value)
    if (!stillValid) selectedId.value = list[0].id
  },
  { immediate: true },
)

function selectList(id: string) {
  selectedId.value = id
}

function createList() {
  const list = store.createToolboxList('新思考清單', '')
  selectedId.value = list.id
}

function saveTitle(title: string) {
  if (!selected.value) return
  store.updateToolboxList(selected.value.id, { title })
}

function savePurpose(purpose: string) {
  if (!selected.value) return
  store.updateToolboxList(selected.value.id, { purpose })
}

function addItem() {
  if (!selected.value) return
  const item = store.createToolboxItem(selected.value.id, '')
  if (!item) return
  pendingFocusItemId.value = item.id
  nextTick(() => {
    pendingFocusItemId.value = null
  })
}

function requestDeleteList(list: ToolboxList) {
  pendingDelete.value = list
  confirmVisible.value = true
}

function confirmDeleteList() {
  if (!pendingDelete.value) return
  store.deleteToolboxList(pendingDelete.value.id)
  pendingDelete.value = null
}

function previewItems(list: ToolboxList): string {
  if (!list.purpose.trim() && !list.items.length) return '尚無內容'
  if (list.purpose.trim()) {
    const text = list.purpose.trim().replace(/\s+/g, ' ')
    return text.length > 48 ? `${text.slice(0, 48)}…` : text
  }
  return `${list.items.length} 項思考點`
}
</script>

<template>
  <div class="toolbox-view">
    <header class="page-header">
      <div>
        <h1>工具箱與思考清單</h1>
        <p class="subtitle">
          建立可重複對照的方向清單；卡住或需要決策時，快速翻出對應思考點。項目可貼上並保留粗體、程式碼等樣式。
        </p>
      </div>
      <button type="button" class="btn-primary" @click="createList">
        + 新增清單
      </button>
    </header>

    <div class="toolbar">
      <input
        v-model="keyword"
        type="text"
        class="search"
        placeholder="搜尋清單標題、用途或項目…"
      />
      <span class="total">共 {{ store.toolboxLists.length }} 份清單</span>
    </div>

    <div v-if="lists.length" class="layout">
      <aside class="list-panel" aria-label="思考清單列表">
        <button
          v-for="list in lists"
          :key="list.id"
          type="button"
          class="list-item"
          :class="{ active: list.id === selectedId }"
          @click="selectList(list.id)"
        >
          <span class="list-title">{{ list.title }}</span>
          <span class="list-meta">
            <span class="count">{{ list.items.length }} 項</span>
            <span class="preview">{{ previewItems(list) }}</span>
          </span>
        </button>
      </aside>

      <section v-if="selected" class="detail">
        <div class="detail-header">
          <div class="detail-titles">
            <InlineEditable
              :model-value="selected.title"
              tag="h3"
              class="detail-title"
              @save="saveTitle"
            />
            <InlineEditable
              :model-value="selected.purpose"
              tag="p"
              class="detail-purpose"
              multiline
              hint
              save-when-empty
              placeholder="這份清單適用什麼方向？例如：需求範圍不清楚、技術選型、優先級衝突…"
              @save="savePurpose"
            />
          </div>
          <button
            type="button"
            class="delete"
            aria-label="刪除此清單"
            @click="requestDeleteList(selected)"
          >
            <AppIcon name="trash" size="sm" />
          </button>
        </div>

        <div class="items-header">
          <h3>思考點</h3>
          <button type="button" class="add-btn" @click="addItem">
            + 新增項目
          </button>
        </div>

        <ol v-if="selected.items.length" class="item-list">
          <ToolboxItemBlock
            v-for="(item, index) in selected.items"
            :key="item.id"
            :list-id="selected.id"
            :item="item"
            :index="index"
            :autofocus="pendingFocusItemId === item.id"
          />
        </ol>
        <p v-else class="empty-items">
          尚無思考點。新增幾條問題或原則，遇到類似方向時就能直接對照。
        </p>
      </section>
    </div>

    <div v-else class="empty">
      <AppIcon name="toolbox" size="lg" class="empty-icon" />
      <p>還沒有思考清單</p>
      <p class="empty-hint">
        例如「需求範圍決策」「技術選型檢查」「優先級衝突」——先建一份，之後卡住就能快速翻看。
      </p>
      <button type="button" class="btn-primary" @click="createList">
        建立第一份清單
      </button>
    </div>

    <ConfirmDialog
      :visible="confirmVisible"
      title="刪除清單"
      :message="`確定刪除「${pendingDelete?.title ?? ''}」？清單內的思考點會一併刪除。`"
      confirm-label="刪除"
      cancel-label="取消"
      danger
      @confirm="confirmDeleteList"
      @close="confirmVisible = false"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;

  h1 {
    font-size: 24px;
    font-weight: 700;
  }
}

.subtitle {
  color: $text-muted;
  font-size: 13px;
  margin-top: 4px;
  line-height: 1.5;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.search {
  flex: 1;
  max-width: 360px;
  padding: 8px 12px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $surface;

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 2px $primary-light;
  }
}

.total {
  font-size: 12px;
  color: $text-muted;
  white-space: nowrap;
}

.btn-primary {
  padding: 8px 16px;
  border-radius: $radius-sm;
  background: $primary;
  color: white;
  font-weight: 600;
  flex-shrink: 0;

  &:hover {
    background: $primary-dark;
  }
}

.layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) 1fr;
  gap: 20px;
  align-items: start;
  min-height: 420px;
}

.list-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 220px);
  overflow-y: auto;
  padding-right: 4px;
}

.list-item {
  text-align: left;
  padding: 12px 14px;
  border: 1px solid $border;
  border-radius: $radius;
  background: $surface;
  display: flex;
  flex-direction: column;
  gap: 6px;

  &:hover {
    border-color: #d1d5db;
  }

  &.active {
    border-color: $primary;
    box-shadow: 0 0 0 2px $primary-light;
  }
}

.list-title {
  font-size: 14px;
  font-weight: 600;
  color: $text;
}

.list-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.count {
  font-size: 11px;
  font-weight: 600;
  color: $primary;
}

.preview {
  font-size: 12px;
  color: $text-muted;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail {
  background: $surface;
  border: 1px solid $border;
  border-radius: $radius;
  box-shadow: $shadow;
  padding: 20px;
  min-width: 0;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid $border;
}

.detail-titles {
  min-width: 0;
  flex: 1;
}

.detail-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 8px;
}

.detail-purpose {
  font-size: 13px;
  line-height: 1.6;
  color: $text-muted;
}

.delete {
  color: $text-muted;
  padding: 6px;
  border-radius: $radius-sm;
  flex-shrink: 0;

  &:hover {
    color: #ef4444;
    background: rgba(#ef4444, 0.1);
  }
}

.items-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  h3 {
    font-size: 12px;
    font-weight: 700;
    color: $text-muted;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
}

.add-btn {
  font-size: 12px;
  color: $primary;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;

  &:hover {
    background: $primary-light;
  }
}

.item-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-items {
  font-size: 13px;
  color: $text-muted;
  line-height: 1.6;
  padding: 12px 0;
}

.empty {
  text-align: center;
  padding: 64px 20px;
  color: $text-muted;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.empty-icon {
  color: $primary;
  opacity: 0.7;
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 13px;
  max-width: 420px;
  line-height: 1.6;
  margin-bottom: 8px;
}

@media (max-width: $breakpoint-md) {
  .layout {
    grid-template-columns: 1fr;
  }

  .list-panel {
    max-height: none;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .list-item {
    min-width: 200px;
  }

  .page-header {
    flex-direction: column;
  }
}
</style>
