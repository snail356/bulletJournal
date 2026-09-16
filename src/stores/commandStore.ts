import { computed, ref } from "vue";
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

export const useCommandStore = defineStore("commands", () => {
  const categories = ref<CommandCategory[]>([]);
  let initialized = false;
  let initPromise: Promise<void> | null = null;

  const saver = createDebouncedSaver(() =>
    saveCommandCategories(categories.value),
  );

  const categoriesSorted = computed(() =>
    [...categories.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );

  function persist() {
    saver.schedule();
  }

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
    if (!category || fromId === toId) return;
    const fromIdx = category.items.findIndex((item) => item.id === fromId);
    const toIdx = category.items.findIndex((item) => item.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const updated = [...category.items];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
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
    categoriesSorted,
    init,
    flush,
    createCategory,
    updateCategory,
    deleteCategory,
    createItem,
    updateItem,
    deleteItem,
    reorderItems,
    mergeCategories,
    clearAll,
  };
});
