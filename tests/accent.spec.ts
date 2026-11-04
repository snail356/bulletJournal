import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ACCENT_KEY } from '@/utils/storage'
import {
  ACCENT_IDS,
  ACCENT_OPTIONS,
  accentSwatch,
  applyAccent,
  DEFAULT_ACCENT,
  isAccentId,
  loadAccent,
  parseAccent,
  saveAccent,
} from '@/utils/accent'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-accent')
  document.documentElement.dataset.theme = 'light'
  document.head.innerHTML = '<meta name="theme-color" content="#7c3aed" />'
})

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-accent')
})

describe('parseAccent / isAccentId', () => {
  it('只接受六種色盤', () => {
    expect(ACCENT_IDS).toEqual([
      'violet',
      'blue',
      'teal',
      'green',
      'orange',
      'rose',
    ])
    expect(isAccentId('blue')).toBe(true)
    expect(isAccentId('purple')).toBe(false)
    expect(isAccentId(null)).toBe(false)
  })

  it('無法辨識時回落紫色', () => {
    expect(parseAccent('teal')).toBe('teal')
    expect(parseAccent('navy')).toBe(DEFAULT_ACCENT)
    expect(parseAccent(undefined)).toBe('violet')
  })
})

describe('loadAccent / saveAccent', () => {
  it('沒有紀錄時為紫色', () => {
    expect(loadAccent()).toBe('violet')
  })

  it('可寫入後再讀回', () => {
    saveAccent('green')
    expect(JSON.parse(localStorage.getItem(ACCENT_KEY) ?? '')).toBe('green')
    expect(loadAccent()).toBe('green')
  })

  it('損壞或非法值時回落紫色', () => {
    localStorage.setItem(ACCENT_KEY, '{not-json')
    expect(loadAccent()).toBe('violet')
    localStorage.setItem(ACCENT_KEY, '"indigo"')
    expect(loadAccent()).toBe('violet')
  })
})

describe('applyAccent', () => {
  it('把 data-accent 寫到 html，日間並更新 theme-color', () => {
    applyAccent('blue')
    expect(document.documentElement.dataset.accent).toBe('blue')
    expect(
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    ).toBe(accentSwatch('blue'))
  })

  it('黑夜模式不改 theme-color 為色盤色', () => {
    document.documentElement.dataset.theme = 'dark'
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', '#111827')
    applyAccent('rose')
    expect(document.documentElement.dataset.accent).toBe('rose')
    expect(
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    ).toBe('#111827')
  })
})

describe('ACCENT_OPTIONS', () => {
  it('色盤選項與 id 對齊，並提供色點', () => {
    expect(ACCENT_OPTIONS.map((item) => item.id)).toEqual([...ACCENT_IDS])
    expect(accentSwatch('violet')).toBe('#7c3aed')
    expect(accentSwatch('orange')).toBe('#ea580c')
  })
})
