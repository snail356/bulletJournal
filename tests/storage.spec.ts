import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STORAGE_BACKEND_KEY,
  clearLegacyLocalData,
  hasStorageKey,
  loadFromStorage,
  removeFromStorage,
  saveToStorage,
} from '@/utils/storage'

const SAMPLE_KEY = 'bullet-journal-test-key'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('loadFromStorage / saveToStorage', () => {
  it('可寫入後再讀回相同資料', () => {
    saveToStorage(SAMPLE_KEY, { open: true, count: 2 })
    expect(loadFromStorage(SAMPLE_KEY, { open: false, count: 0 })).toEqual({
      open: true,
      count: 2,
    })
  })

  it('沒有該 key 時回傳 fallback', () => {
    expect(loadFromStorage(SAMPLE_KEY, 'fallback')).toBe('fallback')
  })

  it('JSON 損壞時回傳 fallback', () => {
    localStorage.setItem(SAMPLE_KEY, '{not-json')
    expect(loadFromStorage(SAMPLE_KEY, 42)).toBe(42)
  })

  it('localStorage 讀取失敗時回傳 fallback', () => {
    saveToStorage(SAMPLE_KEY, ['stored'])
    const spy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    try {
      expect(loadFromStorage(SAMPLE_KEY, ['ok'])).toEqual(['ok'])
    } finally {
      spy.mockRestore()
    }
  })
})

describe('hasStorageKey / removeFromStorage', () => {
  it('有值時為 true，刪除後為 false', () => {
    saveToStorage(SAMPLE_KEY, 'x')
    expect(hasStorageKey(SAMPLE_KEY)).toBe(true)
    removeFromStorage(SAMPLE_KEY)
    expect(hasStorageKey(SAMPLE_KEY)).toBe(false)
  })

  it('空字串仍算有 key', () => {
    localStorage.setItem(SAMPLE_KEY, '')
    expect(hasStorageKey(SAMPLE_KEY)).toBe(true)
  })

  it('讀取失敗時視為沒有 key', () => {
    saveToStorage(SAMPLE_KEY, 'x')
    const spy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    try {
      expect(hasStorageKey(SAMPLE_KEY)).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })

  it('刪除失敗時不丟錯', () => {
    const spy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    try {
      expect(() => removeFromStorage(SAMPLE_KEY)).not.toThrow()
    } finally {
      spy.mockRestore()
    }
  })
})

describe('clearLegacyLocalData', () => {
  it('尚未切到 IndexedDB 時清掉舊 localStorage 資料並標記後端', () => {
    localStorage.setItem('bullet-journal-tasks', '[]')
    localStorage.setItem('bullet-journal-labels', '[]')
    clearLegacyLocalData()
    expect(localStorage.getItem('bullet-journal-tasks')).toBeNull()
    expect(localStorage.getItem('bullet-journal-labels')).toBeNull()
    expect(loadFromStorage(STORAGE_BACKEND_KEY, '')).toBe('idb')
  })

  it('已經是 IndexedDB 後端時不刪舊 key', () => {
    saveToStorage(STORAGE_BACKEND_KEY, 'idb')
    localStorage.setItem('bullet-journal-tasks', 'keep-me')
    clearLegacyLocalData()
    expect(localStorage.getItem('bullet-journal-tasks')).toBe('keep-me')
  })
})
