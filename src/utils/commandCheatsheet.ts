import type { CommandCategory, CommandItem } from "@/types";
import { generateId } from "@/utils/id";

/** 保留中間換行與行首縮排，只去掉結尾空白與 \r\n */
export function normalizeCommandText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\s+$/, "");
}

export function normalizeCommandItem(item: CommandItem): CommandItem {
  return {
    id: item.id || generateId(),
    content: normalizeCommandText(item.content ?? ""),
    note: normalizeCommandText(item.note ?? ""),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
  };
}

export function normalizeCommandCategory(
  category: CommandCategory,
): CommandCategory {
  return {
    id: category.id || generateId(),
    title: category.title ?? "",
    items: (category.items ?? []).map(normalizeCommandItem),
    createdAt: category.createdAt || new Date().toISOString(),
    updatedAt:
      category.updatedAt || category.createdAt || new Date().toISOString(),
  };
}

export function createDefaultCommandCategories(): CommandCategory[] {
  const now = new Date().toISOString();
  return [
    {
      id: generateId(),
      title: "git 指令",
      items: [
        {
          id: generateId(),
          content: "git reset --soft HEAD^",
          note: "想保留修改但取消 commit",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: generateId(),
          content: "git merge --no-commit --no-ff <分支名稱>",
          note: "merge 但不直接推",
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      title: "DeskIn 帳密",
      items: [
        {
          id: generateId(),
          content: "carol.cheng@newtype.com.tw",
          note: "帳號",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: generateId(),
          content: "New@type1",
          note: "密碼",
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}
