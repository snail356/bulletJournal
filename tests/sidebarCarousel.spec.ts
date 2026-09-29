import { describe, expect, it } from 'vitest'
import type { SidebarCarouselImage, SidebarCarouselState } from '@/types'
import {
  getSidebarCarouselCurrentImage,
  getSidebarCarouselNextSwitchAt,
} from '@/utils/sidebarCarousel'

function image(id: string): SidebarCarouselImage {
  return {
    id,
    fileName: id,
    imageUrl: 'data:image/png;base64,xx',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function state(patch: Partial<SidebarCarouselState> = {}): SidebarCarouselState {
  return {
    enabled: true,
    mode: 'interval',
    intervalHours: 1,
    images: [image('a'), image('b'), image('c')],
    selectedImageId: null,
    selectedAt: null,
    ...patch,
  }
}

describe('getSidebarCarouselCurrentImage', () => {
  it('手動選圖後仍依間隔換下一張', () => {
    const anchor = new Date(2026, 8, 29, 10, 0, 0).getTime()
    const carousel = state({
      selectedImageId: 'b',
      selectedAt: new Date(anchor).toISOString(),
    })

    expect(getSidebarCarouselCurrentImage(carousel, anchor)?.id).toBe('b')
    expect(
      getSidebarCarouselCurrentImage(carousel, anchor + 60 * 60 * 1000)?.id,
    ).toBe('c')
    expect(
      getSidebarCarouselCurrentImage(carousel, anchor + 2 * 60 * 60 * 1000)?.id,
    ).toBe('a')
  })

  it('沒有起算時間時，已選圖片不會把輪播固定住', () => {
    const now = new Date(2026, 8, 29, 10, 30, 0).getTime()
    const pinned = state({ selectedImageId: 'c', selectedAt: null })
    const automatic = state()

    expect(getSidebarCarouselCurrentImage(pinned, now)?.id).toBe(
      getSidebarCarouselCurrentImage(automatic, now)?.id,
    )
  })

  it('每日輪播隔日換下一張', () => {
    const anchor = new Date(2026, 8, 29, 10, 0, 0).getTime()
    const carousel = state({
      mode: 'daily',
      selectedImageId: 'a',
      selectedAt: new Date(anchor).toISOString(),
    })

    expect(getSidebarCarouselCurrentImage(carousel, anchor)?.id).toBe('a')
    expect(
      getSidebarCarouselCurrentImage(
        carousel,
        new Date(2026, 8, 30, 0, 5, 0).getTime(),
      )?.id,
    ).toBe('b')
  })

  it('兩張以上才有下次換圖時間', () => {
    const now = new Date(2026, 8, 29, 10, 15, 0).getTime()
    expect(getSidebarCarouselNextSwitchAt(state({ images: [image('a')] }), now)).toBeNull()

    const anchor = new Date(2026, 8, 29, 10, 0, 0).getTime()
    const next = getSidebarCarouselNextSwitchAt(
      state({
        intervalHours: 6,
        selectedImageId: 'a',
        selectedAt: new Date(anchor).toISOString(),
      }),
      now,
    )
    expect(next).toBe(anchor + 6 * 60 * 60 * 1000)
  })
})
