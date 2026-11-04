import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { saveAccent } from '@/utils/accent'
import { THEME_KEY } from '@/utils/storage'
import {
  applyTheme,
  DARK_THEME_COLOR,
  isTheme,
  LIGHT_THEME_COLOR,
  loadTheme,
  nextTheme,
  parseTheme,
  saveTheme,
} from '@/utils/theme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.head.innerHTML = '<meta name="theme-color" content="#7c3aed" />'
})

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('parseTheme / isTheme', () => {
  it('只接受 light 與 dark', () => {
    expect(isTheme('light')).toBe(true)
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('system')).toBe(false)
    expect(isTheme(null)).toBe(false)
  })

  it('無法辨識時回落日間', () => {
    expect(parseTheme('dark')).toBe('dark')
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('auto')).toBe('light')
    expect(parseTheme(undefined)).toBe('light')
  })
})

describe('nextTheme', () => {
  it('日間與黑夜互相切換', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
  })
})

describe('loadTheme / saveTheme', () => {
  it('沒有紀錄時為日間', () => {
    expect(loadTheme()).toBe('light')
  })

  it('可寫入後再讀回', () => {
    saveTheme('dark')
    expect(JSON.parse(localStorage.getItem(THEME_KEY) ?? '')).toBe('dark')
    expect(loadTheme()).toBe('dark')
  })

  it('損壞或非法值時回落日間', () => {
    localStorage.setItem(THEME_KEY, '{not-json')
    expect(loadTheme()).toBe('light')
    localStorage.setItem(THEME_KEY, '"system"')
    expect(loadTheme()).toBe('light')
  })
})

describe('applyTheme', () => {
  it('把 data-theme 寫到 html，並更新 theme-color', () => {
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    ).toBe(DARK_THEME_COLOR)

    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    ).toBe(LIGHT_THEME_COLOR)
  })

  it('沒有 theme-color meta 時不丟錯', () => {
    document.head.innerHTML = ''
    expect(() => applyTheme('dark')).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('日間 theme-color 跟著已選主色', () => {
    saveAccent('teal')
    applyTheme('light')
    expect(
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    ).toBe('#0d9488')
  })
})
