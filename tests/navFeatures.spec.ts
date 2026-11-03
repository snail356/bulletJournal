import { describe, expect, it } from 'vitest'
import {
  NAV_FEATURES,
  defaultNavFeatureOrder,
  defaultNavFeatureVisibility,
  getOrderedNavFeatures,
  normalizeNavFeatureOrder,
  normalizeNavFeatureVisibility,
  type NavFeatureId,
} from '@/utils/navFeatures'

describe('normalizeNavFeatureVisibility', () => {
  it('沒有資料時用預設，且設定永遠開啟', () => {
    expect(normalizeNavFeatureVisibility(null)).toEqual(
      defaultNavFeatureVisibility,
    )
    expect(
      normalizeNavFeatureVisibility({ settings: false, today: false }),
    ).toMatchObject({
      today: false,
      settings: true,
    })
  })

  it('可覆寫其餘功能開關', () => {
    const visibility = normalizeNavFeatureVisibility({
      backlog: true,
      xiaoguli: false,
    })
    expect(visibility.backlog).toBe(true)
    expect(visibility.xiaoguli).toBe(false)
    expect(visibility.calendar).toBe(defaultNavFeatureVisibility.calendar)
  })
})

describe('normalizeNavFeatureOrder', () => {
  it('非陣列時回完整預設順序', () => {
    expect(normalizeNavFeatureOrder(null)).toEqual(defaultNavFeatureOrder)
    expect(normalizeNavFeatureOrder('today')).toEqual(defaultNavFeatureOrder)
  })

  it('略過未知與重複 id，並補齊缺的功能', () => {
    const order = normalizeNavFeatureOrder([
      'today',
      'not-a-feature',
      'today',
      1,
    ])
    expect(order[0]).toBe('today')
    expect(order.at(-1)).toBe('settings')
    expect(new Set(order)).toEqual(new Set(defaultNavFeatureOrder))
    expect(order.filter((id) => id === 'today')).toHaveLength(1)
  })

  it('設定已在清單中時，缺的功能插在設定前面', () => {
    const order = normalizeNavFeatureOrder(['settings', 'today'])
    expect(order.includes('calendar')).toBe(true)
    expect(order.indexOf('settings')).toBeLessThan(order.indexOf('today'))
    expect(new Set(order)).toEqual(new Set(defaultNavFeatureOrder))
  })

  it('已完整的自訂順序會被保留', () => {
    const custom: NavFeatureId[] = [
      'xiaoguli',
      'today',
      'calendar',
      'all-tasks',
      'toolbox',
      'commands',
      'reflections',
      'stats',
      'backlog',
      'settings',
    ]
    expect(normalizeNavFeatureOrder(custom)).toEqual(custom)
  })
})

describe('getOrderedNavFeatures', () => {
  it('依 id 對回功能定義，略過未知 id', () => {
    const features = getOrderedNavFeatures([
      'today',
      'missing' as NavFeatureId,
      'settings',
    ])
    expect(features.map((feature) => feature.id)).toEqual(['today', 'settings'])
    expect(features[0]).toBe(NAV_FEATURES[0])
  })
})
