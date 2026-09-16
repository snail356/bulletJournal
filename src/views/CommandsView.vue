<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AppSwitch from '@/components/AppSwitch.vue'
import CommandCategoryCard from '@/components/CommandCategoryCard.vue'
import { useSimpleReorderDrag } from '@/composables/useReorderDrag'
import { useCommandStore } from '@/stores/commandStore'

const store = useCommandStore()
const keyword = ref('')
const { draggingId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd } =
  useSimpleReorderDrag(
    () => store.categories,
    (fromId, toId) => store.reorderCategories(fromId, toId),
  )

const categories = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  const all = store.categories
  if (!query) return all
  return all.filter((category) => {
    const haystack = [
      category.title,
      ...category.items.map((item) => `${item.content}\n${item.note}`),
    ]
      .join('\n')
      .toLowerCase()
    return haystack.includes(query)
  })
})

const itemCount = computed(() =>
  store.categories.reduce((sum, category) => sum + category.items.length, 0),
)

function createCategory() {
  store.createCategory('新類別')
}
</script>

<template>
  <div class="commands-view">
    <header class="page-header">
      <div>
        <h1>常用指令</h1>
        <p class="subtitle">
          依類別收藏指令與帳密；點選可複製。收合時可拖曳類別，展開後可拖曳指令。
        </p>
      </div>
      <div class="header-actions">
        <AppSwitch
          :model-value="store.expandCategories"
          label="展開類別"
          @update:model-value="store.expandCategories = $event"
        />
        <button type="button" class="btn-primary" @click="createCategory">
          + 新增類別
        </button>
      </div>
    </header>

    <div class="toolbar">
      <input
        v-model="keyword"
        type="text"
        class="search"
        placeholder="搜尋類別、指令或說明…"
      />
      <span class="total">共 {{ store.categories.length }} 個類別、{{ itemCount }} 筆</span>
    </div>

    <div v-if="categories.length" class="category-list">
      <CommandCategoryCard
        v-for="category in categories"
        :key="category.id"
        :category="category"
        :dragging="draggingId === category.id"
        :drag-over="dragOverId === category.id"
        @drag-start="onDragStart($event, category.id)"
        @drag-over="onDragOver($event, category.id)"
        @drop="onDrop($event, category.id)"
        @drag-end="onDragEnd"
      />
    </div>

    <div v-else class="empty">
      <AppIcon name="code" size="lg" class="empty-icon" />
      <p>{{ keyword.trim() ? '沒有符合的指令' : '還沒有類別' }}</p>
      <p class="empty-hint">
        例如 git 指令、常用帳密——先建一個類別，之後就能一鍵複製。
      </p>
      <button
        v-if="!keyword.trim()"
        type="button"
        class="btn-primary"
        @click="createCategory"
      >
        建立第一個類別
      </button>
    </div>
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
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

.category-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  .page-header {
    flex-direction: column;
  }
}
</style>
