const TASKS_KEY = 'bullet-journal-tasks'
const LABELS_KEY = 'bullet-journal-labels'
const SELECTED_DATE_KEY = 'bullet-journal-selected-date'

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

export { TASKS_KEY, LABELS_KEY, SELECTED_DATE_KEY }
