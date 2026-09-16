<script setup lang="ts">
import { nextTick, ref } from 'vue'
import CommandItemRow from '@/components/CommandItemRow.vue'
import DeleteIconButton from '@/components/DeleteIconButton.vue'
import InlineEditable from '@/components/InlineEditable.vue'
import { useSimpleReorderDrag } from '@/composables/useReorderDrag'
import { useCommandStore } from '@/stores/commandStore'
import type { CommandCategory } from '@/types'

const props = defineProps<{
  category: CommandCategory
}>()

const store = useCommandStore()
const pendingFocusItemId = ref<string | null>(null)
const { draggingId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd } =
  useSimpleReorderDrag(
    () => props.category.items,
    (fromId, toId) => store.reorderItems(props.category.id, fromId, toId),
  )

function addItem() {
  const item = store.createItem(props.category.id)
  if (!item) return
  pendingFocusItemId.value = item.id
  nextTick(() => {
    pendingFocusItemId.value = null
  })
}
</script>

<template>
  <section class="category-card">
    <div class="category-header">
      <InlineEditable
        :model-value="category.title"
        tag="h3"
        class="category-title"
        @save="store.updateCategory(category.id, $event)"
      />
      <div class="category-actions">
        <button type="button" class="add-btn" @click="addItem">
          + 新增指令
        </button>
        <DeleteIconButton
          title="刪除類別"
          :message="`確定刪除「${category.title}」？類別內的指令會一併刪除。`"
          label="刪除類別"
          @confirm="store.deleteCategory(category.id)"
        />
      </div>
    </div>

    <ul v-if="category.items.length" class="item-list">
      <CommandItemRow
        v-for="item in category.items"
        :key="item.id"
        :category-id="category.id"
        :item="item"
        :autofocus="pendingFocusItemId === item.id"
        :dragging="draggingId === item.id"
        :drag-over="dragOverId === item.id"
        @drag-start="onDragStart($event, item.id)"
        @drag-over="onDragOver($event, item.id)"
        @drop="onDrop($event, item.id)"
        @drag-end="onDragEnd"
      />
    </ul>
    <p v-else class="empty-items">
      尚無指令。新增一筆後即可點選複製。
    </p>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.category-card {
  background: $surface;
  border: 1px solid $border;
  border-radius: $radius;
  box-shadow: $shadow;
  padding: 18px 20px;
}

.category-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.category-title {
  font-size: 18px;
  font-weight: 700;
  min-width: 0;
  flex: 1;
}

.category-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
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
  padding: 4px 0 2px;
}

@media (max-width: $breakpoint-md) {
  .category-header {
    flex-direction: column;
  }
}
</style>
