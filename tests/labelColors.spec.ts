import { describe, expect, it } from 'vitest'
import {
  getLabelBgForColor,
  LABEL_BG,
  LABEL_BG_FALLBACK,
  LABEL_COLORS,
} from '@/utils/labelColors'

describe('getLabelBgForColor', () => {
  it('已知顏色回傳對應 CSS 變數', () => {
    expect(getLabelBgForColor('#7c3aed')).toBe(LABEL_BG['#7c3aed'])
    expect(getLabelBgForColor('#3b82f6')).toBe('var(--label-bg-blue)')
    expect(LABEL_COLORS).toHaveLength(6)
  })

  it('未知顏色回落灰色背景變數', () => {
    expect(getLabelBgForColor('#ffffff')).toBe(LABEL_BG_FALLBACK)
    expect(getLabelBgForColor('')).toBe(LABEL_BG_FALLBACK)
  })
})
