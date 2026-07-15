import type {
  GeminiUsageState,
  MigrationReviewState,
  ReflectionPromptState,
} from '@/types'

const TASKS_KEY = 'bullet-journal-tasks'
const LABELS_KEY = 'bullet-journal-labels'
const SELECTED_DATE_KEY = 'bullet-journal-selected-date'
const EXPAND_IMAGES_KEY = 'bullet-journal-expand-images'
const EXPAND_TASKS_KEY = 'bullet-journal-expand-tasks'
const MIGRATION_REVIEW_KEY = 'bullet-journal-migration-review'
const DIFFICULTY_NOTES_KEY = 'bullet-journal-difficulty-notes'
const STATUS_ITEMS_KEY = 'bullet-journal-status-items'
const DAILY_REFLECTIONS_KEY = 'bullet-journal-daily-reflections'
const REFLECTION_PROMPT_KEY = 'bullet-journal-reflection-prompt'
const GEMINI_USAGE_KEY = 'bullet-journal-gemini-usage'
const AI_MANAGER_PROMPT_KEY = 'bullet-journal-ai-manager-prompt'

const defaultMigrationReviewState: MigrationReviewState = {
  snoozedUntil: null,
  keptTodayTaskIds: {},
  lastReviewedDate: null,
}

const defaultReflectionPromptState: ReflectionPromptState = {
  snoozedUntil: null,
  lastReflectedDate: null,
}

const defaultGeminiUsageState: GeminiUsageState = {
  totalSuccessCalls: 0,
  lastCalledAt: null,
  lastError: null,
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function hasStorageKey(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

export {
  TASKS_KEY,
  LABELS_KEY,
  SELECTED_DATE_KEY,
  EXPAND_IMAGES_KEY,
  EXPAND_TASKS_KEY,
  MIGRATION_REVIEW_KEY,
  DIFFICULTY_NOTES_KEY,
  STATUS_ITEMS_KEY,
  DAILY_REFLECTIONS_KEY,
  REFLECTION_PROMPT_KEY,
  GEMINI_USAGE_KEY,
  AI_MANAGER_PROMPT_KEY,
  defaultMigrationReviewState,
  defaultReflectionPromptState,
  defaultGeminiUsageState,
}
