<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import CommandItemRow from '@/components/CommandItemRow.vue'
import DeleteIconButton from '@/components/DeleteIconButton.vue'
import DragHandle from '@/components/DragHandle.vue'
import InlineEditable from '@/components/InlineEditable.vue'
import { useSimpleReorderDrag } from '@/composables/useReorderDrag'
import { useCommandStore } from '@/stores/commandStore'
import type { CommandCategory } from '@/types'

const props = defineProps<{
  category: CommandCategory
  dragging?: boolean
  dragOver?: boolean
}>()

const emit = defineEmits<{
  dragStart: [event: DragEvent]
  dragOver: [event: DragEvent]
  drop: [event: DragEvent]
  dragEnd: []
}>()

const store = useCommandStore()
const expanded = ref(store.expandCategories)
const pendingFocusItemId = ref<string | null>(null)
const { draggingId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd } =
  useSimpleReorderDrag(
    () => props.category.items,
    (fromId, toId) => store.reorderItems(props.category.id, fromId, toId),
  )

watch(
  () => store.expandCategories,
  (value) => {
    expanded.value = value
  },
)

const showCategoryDrag = computed(() => !expanded.value)

function toggleExpanded() {
  expanded.value = !expanded.value
}

function addItem() {
  expanded.value = true
  const item = store.createItem(props.category.id)
  if (!item) return
  pendingFocusItemId.value = item.id
  nextTick(() => {
    pendingFocusItemId.value = null
  })
}
</script>

<template>
  <section
    class="category-card"
    :class="{ dragging, 'drag-over': dragOver, collapsed: !expanded }"
    @dragover="emit('dragOver', $event)"
    @drop="emit('drop', $event)"
  >
    <div class="category-header">
      <DragHandle
        v-if="showCategoryDrag"
        class="category-drag"
        @drag-start="emit('dragStart', $event)"
        @drag-end="emit('dragEnd')"
      />
      <InlineEditable
        :model-value="category.title"
        tag="h3"
        class="category-title"
        @save="store.updateCategory(category.id, $event)"
      />
      <span class="item-count">{{ category.items.length }} 筆</span>
      <div class="category-actions">
        <button
          type="button"
          class="expand-btn"
          :aria-expanded="expanded"
          :aria-label="expanded ? '收合類別' : '展開類別'"
          @click="toggleExpanded"
        >
          <AppIcon :name="expanded ? 'chevron-down' : 'chevron-right'" />
        </button>
        <button v-if="expanded" type="button" class="add-btn" @click="addItem">
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

    <template v-if="expanded">
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
    </template>
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
  transition: opacity 0.15s, box-shadow 0.15s;

  &.dragging {
    opacity: 0.45;
  }

  &.drag-over {
    box-shadow: $shadow, inset 0 -2px 0 $primary;
  }

  &.collapsed .category-header {
    margin-bottom: 0;
  }
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.category-drag {
  margin-top: 2px;
}

.category-title {
  font-size: 18px;
  font-weight: 700;
  min-width: 0;
  flex: 1;
}

.item-count {
  font-size: 12px;
  font-weight: 600;
  color: $text-muted;
  white-space: nowrap;
}

.category-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.expand-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: $text-muted;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: $bg;
    color: $primary;
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
  padding: 4px 0 2px;
}

@media (max-width: $breakpoint-md) {
  .category-header {
    flex-wrap: wrap;
  }
}
</style>
