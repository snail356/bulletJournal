import { describe, expect, it } from 'vitest'
import {
  ALL_STATUSES,
  COMPLETED_STATUS_ID,
  DEFAULT_STATUS_ID,
  STATUS_COLORS,
  createDefaultStatusItems,
  createUnknownStatusItem,
  getBuiltinStatusName,
  getStatusBgForColor,
  isCompletedStatus,
  normalizeStatusItems,
  parseStatusSortOnSelect,
} from '@/utils/status'

describe('isCompletedStatus', () => {
  it('只把 done 視為已完成', () => {
    expect(isCompletedStatus(COMPLETED_STATUS_ID)).toBe(true)
    expect(isCompletedStatus(DEFAULT_STATUS_ID)).toBe(false)
    expect(isCompletedStatus('custom')).toBe(false)
  })
})

describe('createDefaultStatusItems', () => {
  it('產出全部內建狀態，待 PM 預設移到底部', () => {
    const items = createDefaultStatusItems()
    expect(items.map((item) => item.id)).toEqual([...ALL_STATUSES])
    expect(items.find((item) => item.id === 'waiting_pm')?.sortOnSelect).toBe(
      'bottom',
    )
    expect(items.find((item) => item.id === 'in_progress')?.sortOnSelect).toBe(
      'none',
    )
  })
})

describe('createUnknownStatusItem / getBuiltinStatusName', () => {
  it('未知狀態用灰色並以 id 當名稱', () => {
    expect(createUnknownStatusItem('hotfix')).toEqual({
      id: 'hotfix',
      name: 'hotfix',
      color: '#9ca3af',
      bgColor: '#f3f4f6',
      sortOnSelect: 'none',
    })
  })

  it('內建 id 可查出中文名稱，未知則為 undefined', () => {
    expect(getBuiltinStatusName('paused')).toBe('暫停中')
    expect(getBuiltinStatusName('not-real')).toBeUndefined()
  })
})

describe('parseStatusSortOnSelect', () => {
  it('接受英文與中文標籤', () => {
    expect(parseStatusSortOnSelect('top')).toBe('top')
    expect(parseStatusSortOnSelect('至頂')).toBe('top')
    expect(parseStatusSortOnSelect('移至底部（已完成之上）')).toBe('bottom')
    expect(parseStatusSortOnSelect('NONE')).toBe('none')
  })

  it('無法辨識時 waiting_pm 預設 bottom，其餘為 none', () => {
    expect(parseStatusSortOnSelect(undefined, 'waiting_pm')).toBe('bottom')
    expect(parseStatusSortOnSelect('???', 'in_progress')).toBe('none')
  })
})

describe('normalizeStatusItems', () => {
  it('空陣列或 null 回預設清單', () => {
    expect(normalizeStatusItems(null)).toEqual(createDefaultStatusItems())
    expect(normalizeStatusItems([])).toEqual(createDefaultStatusItems())
  })

  it('去掉空白 id 與重複 id，並補上缺的名稱與顏色', () => {
    const normalized = normalizeStatusItems([
      {
        id: '  in_progress  ',
        name: '',
        color: '',
        bgColor: '',
        sortOnSelect: 'none',
      },
      {
        id: 'in_progress',
        name: '重複應被略過',
        color: '#000',
        bgColor: '#fff',
        sortOnSelect: 'top',
      },
      {
        id: '   ',
        name: '無效',
        color: '#000',
        bgColor: '#fff',
        sortOnSelect: 'none',
      },
      {
        id: 'custom',
        name: ' 自訂 ',
        color: '#123456',
        bgColor: '',
        sortOnSelect: 'top',
      },
    ])

    expect(normalized).toHaveLength(2)
    expect(normalized[0]).toMatchObject({
      id: 'in_progress',
      name: '進行中',
      color: STATUS_COLORS.in_progress,
    })
    expect(normalized[1]).toMatchObject({
      id: 'custom',
      name: '自訂',
      color: '#123456',
      bgColor: '#f3f4f6',
      sortOnSelect: 'top',
    })
  })

  it('全部 id 無效時回預設清單', () => {
    expect(
      normalizeStatusItems([
        {
          id: '  ',
          name: 'x',
          color: '#000',
          bgColor: '#fff',
          sortOnSelect: 'none',
        },
      ]),
    ).toEqual(createDefaultStatusItems())
  })
})

describe('getStatusBgForColor', () => {
  it('對到內建色就回對應底色，否則灰色', () => {
    expect(getStatusBgForColor(STATUS_COLORS.done)).toBe('#dcfce7')
    expect(getStatusBgForColor('#ffffff')).toBe('#f3f4f6')
  })
})
