import { ref, watch } from "vue";
import { defineStore } from "pinia";
import type { CommandCategory, CommandItem } from "@/types";
import {
  createDebouncedSaver,
  loadCommandCategories,
  saveCommandCategories,
} from "@/utils/appData";
import {
  createDefaultCommandCategories,
  normalizeCommandCategory,
  normalizeCommandItem,
  normalizeCommandText,
} from "@/utils/commandCheatsheet";
import { generateId } from "@/utils/id";
import { moveItemById } from "@/composables/useReorderDrag";
import {
  EXPAND_COMMANDS_KEY,
  loadFromStorage,
  saveToStorage,
} from "@/utils/storage";

export const useCommandStore = defineStore("commands", () => {
  const categories = ref<CommandCategory[]>([]);
  const expandCategories = ref(loadFromStorage(EXPAND_COMMANDS_KEY, true));
  let initialized = false;
  let initPromise: Promise<void> | null = null;

  const saver = createDebouncedSaver(() =>
    saveCommandCategories(categories.value),
  );

  function persist() {
    saver.schedule();
  }

  watch(expandCategories, (value) => {
    saveToStorage(EXPAND_COMMANDS_KEY, value);
  });

  async function flush() {
    await saver.flush();
  }

  async function init() {
    if (initialized) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const stored = await loadCommandCategories();
      saver.enable();
      if (stored === null) {
        categories.value = createDefaultCommandCategories();
        persist();
        await flush();
      } else {
        categories.value = stored.map(normalizeCommandCategory);
      }
      initialized = true;
    })();

    return initPromise;
  }

  function findCategory(categoryId: string): CommandCategory | undefined {
    return categories.value.find((category) => category.id === categoryId);
  }

  function createCategory(title = ""): CommandCategory {
    const now = new Date().toISOString();
    const category: CommandCategory = {
      id: generateId(),
      title: title.trim() || "新類別",
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    categories.value.unshift(category);
    persist();
    return category;
  }

  function updateCategory(categoryId: string, title: string) {
    const category = findCategory(categoryId);
    if (!category) return;
    category.title = title.trim() || "未命名類別";
    category.updatedAt = new Date().toISOString();
    persist();
  }

  function deleteCategory(categoryId: string) {
    categories.value = categories.value.filter(
      (category) => category.id !== categoryId,
    );
    persist();
  }

  function reorderCategories(fromId: string, toId: string) {
    const updated = moveItemById(categories.value, fromId, toId);
    if (!updated) return;
    categories.value = updated;
    persist();
  }

  function createItem(
    categoryId: string,
    content = "",
    note = "",
  ): CommandItem | null {
    const category = findCategory(categoryId);
    if (!category) return null;
    const now = new Date().toISOString();
    const item: CommandItem = {
      id: generateId(),
      content: normalizeCommandText(content),
      note: normalizeCommandText(note),
      createdAt: now,
      updatedAt: now,
    };
    category.items.push(item);
    category.updatedAt = now;
    persist();
    return item;
  }

  function updateItem(
    categoryId: string,
    itemId: string,
    payload: Partial<Pick<CommandItem, "content" | "note">>,
  ) {
    const category = findCategory(categoryId);
    if (!category) return;
    const item = category.items.find((entry) => entry.id === itemId);
    if (!item) return;
    if (payload.content !== undefined) {
      item.content = normalizeCommandText(payload.content);
    }
    if (payload.note !== undefined) {
      item.note = normalizeCommandText(payload.note);
    }
    const now = new Date().toISOString();
    item.updatedAt = now;
    category.updatedAt = now;
    persist();
  }

  function deleteItem(categoryId: string, itemId: string) {
    const category = findCategory(categoryId);
    if (!category) return;
    category.items = category.items.filter((item) => item.id !== itemId);
    category.updatedAt = new Date().toISOString();
    persist();
  }

  function reorderItems(categoryId: string, fromId: string, toId: string) {
    const category = findCategory(categoryId);
    if (!category) return;
    const updated = moveItemById(category.items, fromId, toId);
    if (!updated) return;
    category.items = updated;
    persist();
  }

  async function mergeCategories(incoming: CommandCategory[]) {
    const summary = { added: 0, skipped: 0, itemsAdded: 0, itemsSkipped: 0 };
    const byId = new Map(
      categories.value.map((category) => [category.id, category]),
    );
    const byTitle = new Map(
      categories.value.map((category) => [category.title.trim(), category]),
    );
    const added: CommandCategory[] = [];

    for (const raw of incoming.map(normalizeCommandCategory)) {
      const title = raw.title.trim() || "未命名類別";
      const existing = byId.get(raw.id) ?? byTitle.get(title);
      if (existing) {
        summary.skipped += 1;
        const itemIds = new Set(existing.items.map((item) => item.id));
        const itemContents = new Set(
          existing.items.map((item) => item.content.trim()).filter(Boolean),
        );
        let changed = false;
        for (const item of raw.items) {
          const content = item.content.trim();
          if (itemIds.has(item.id) || (content && itemContents.has(content))) {
            summary.itemsSkipped += 1;
            continue;
          }
          existing.items.push(normalizeCommandItem(item));
          itemIds.add(item.id);
          if (content) itemContents.add(content);
          summary.itemsAdded += 1;
          changed = true;
        }
        if (changed) {
          existing.updatedAt = new Date().toISOString();
        }
        continue;
      }

      const next = { ...raw, title };
      added.push(next);
      byId.set(next.id, next);
      byTitle.set(title, next);
      summary.added += 1;
    }

    if (added.length || summary.itemsAdded) {
      if (added.length) {
        categories.value = [...added, ...categories.value];
      }
      persist();
      await flush();
    }

    return summary;
  }

  async function clearAll() {
    categories.value = [];
    persist();
    await flush();
  }

  return {
    categories,
    expandCategories,
    init,
    flush,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    createItem,
    updateItem,
    deleteItem,
    reorderItems,
    mergeCategories,
    clearAll,
  };
});
