import { describe, expect, it } from 'vitest'
import {
  NOTE_COLOR_BG,
  NOTE_COLOR_DOT,
  NOTE_COLOR_OPTIONS,
} from '@/utils/noteColors'

const COLORS = ['yellow', 'red', 'purple', 'orange', 'green', 'blue', 'gray'] as const

describe('noteColors', () => {
  it('每種備註色都有對應的 CSS 變數背景與色點', () => {
    for (const color of COLORS) {
      expect(NOTE_COLOR_BG[color]).toBe(`var(--note-${color}-bg)`)
      expect(NOTE_COLOR_DOT[color]).toBe(`var(--note-${color}-dot)`)
    }
  })

  it('色點選項涵蓋全部備註色', () => {
    expect(NOTE_COLOR_OPTIONS.map((item) => item.value)).toEqual([...COLORS])
    expect(NOTE_COLOR_OPTIONS.map((item) => item.color)).toEqual(
      COLORS.map((color) => NOTE_COLOR_DOT[color]),
    )
  })
})
