import type {
  GeminiUsageState,
  MigrationReviewState,
  ReflectionPromptState,
} from "@/types";

const SELECTED_DATE_KEY = "bullet-journal-selected-date";
const EXPAND_IMAGES_KEY = "bullet-journal-expand-images";
const EXPAND_TASKS_KEY = "bullet-journal-expand-tasks";
const MIGRATION_REVIEW_KEY = "bullet-journal-migration-review";
const REFLECTION_PROMPT_KEY = "bullet-journal-reflection-prompt";
const GEMINI_USAGE_KEY = "bullet-journal-gemini-usage";
const NAV_FEATURES_KEY = "bullet-journal-nav-features";
const NAV_FEATURE_ORDER_KEY = "bullet-journal-nav-feature-order";
const AURORA_MODE_KEY = "bullet-journal-aurora-mode";
const FLOATING_SPHERE_POSITION_KEY = "bullet-journal-floating-sphere-position";
const BACKUP_PREFS_KEY = "bullet-journal-backup-prefs";
const STORAGE_BACKEND_KEY = "bullet-journal-storage-backend";

const LEGACY_LOCAL_DATA_KEYS = [
  "bullet-journal-tasks",
  "bullet-journal-labels",
  "bullet-journal-status-items",
  "bullet-journal-daily-reflections",
  "bullet-journal-toolbox-lists",
  "bullet-journal-task-avatars",
  "bullet-journal-sidebar-carousel",
  "bullet-journal-stock-favorites",
  "bullet-journal-ai-manager-prompt",
  "bullet-journal-difficulty-notes",
  "bullet-journal-stock-ex-announce",
  "bullet-journal-stock-dividends",
] as const;

const defaultMigrationReviewState: MigrationReviewState = {
  snoozedUntil: null,
  keptTodayTaskIds: {},
  lastReviewedDate: null,
};

const defaultReflectionPromptState: ReflectionPromptState = {
  snoozedUntil: null,
  lastReflectedDate: null,
};

const defaultGeminiUsageState: GeminiUsageState = {
  totalSuccessCalls: 0,
  lastCalledAt: null,
  lastError: null,
};

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function hasStorageKey(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

export function clearLegacyLocalData(): void {
  if (loadFromStorage<string>(STORAGE_BACKEND_KEY, "") === "idb") return;
  for (const key of LEGACY_LOCAL_DATA_KEYS) {
    removeFromStorage(key);
  }
  saveToStorage(STORAGE_BACKEND_KEY, "idb");
}

export {
  SELECTED_DATE_KEY,
  EXPAND_IMAGES_KEY,
  EXPAND_TASKS_KEY,
  MIGRATION_REVIEW_KEY,
  REFLECTION_PROMPT_KEY,
  GEMINI_USAGE_KEY,
  NAV_FEATURES_KEY,
  NAV_FEATURE_ORDER_KEY,
  AURORA_MODE_KEY,
  FLOATING_SPHERE_POSITION_KEY,
  BACKUP_PREFS_KEY,
  STORAGE_BACKEND_KEY,
  defaultMigrationReviewState,
  defaultReflectionPromptState,
  defaultGeminiUsageState,
};
