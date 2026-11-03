import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultBackupPrefs,
  formatLastDownloadedAt,
  isAutoBackupDue,
  loadBackupPrefs,
  markBackupDownloaded,
  normalizeBackupPrefs,
  saveBackupPrefs,
  scheduledBackupDate,
  updateBackupPrefs,
  weekdayLabel,
} from '@/utils/backupPrefs'
import { BACKUP_PREFS_KEY } from '@/utils/storage'

beforeEach(() => {
  localStorage.clear()
})

describe('normalizeBackupPrefs', () => {
  it('無效輸入回預設，且 autoEnabled 必須是布林 true', () => {
    expect(normalizeBackupPrefs(null)).toEqual(defaultBackupPrefs())
    expect(normalizeBackupPrefs({ autoEnabled: 'true' })).toMatchObject({
      autoEnabled: false,
      frequency: 'weekly',
    })
  })

  it('校正超出範圍的星期與日期，並修剪資料夾名稱', () => {
    expect(
      normalizeBackupPrefs({
        autoEnabled: true,
        frequency: 'monthly',
        weeklyDay: 9,
        monthlyDate: 0,
        lastDownloadedAt: '',
        lastAutoDownloadedAt: '2026-11-01T00:00:00.000Z',
        folderName: '  backups  ',
      }),
    ).toEqual({
      autoEnabled: true,
      frequency: 'monthly',
      weeklyDay: 0,
      monthlyDate: 1,
      lastDownloadedAt: null,
      lastAutoDownloadedAt: '2026-11-01T00:00:00.000Z',
      folderName: 'backups',
    })
  })
})

describe('load / save / update', () => {
  it('沒有資料時載入預設，寫入後可讀回', () => {
    expect(loadBackupPrefs()).toEqual(defaultBackupPrefs())
    saveBackupPrefs({
      ...defaultBackupPrefs(),
      autoEnabled: true,
      frequency: 'monthly',
      monthlyDate: 15,
    })
    expect(localStorage.getItem(BACKUP_PREFS_KEY)).toContain('"monthly"')
    expect(loadBackupPrefs()).toMatchObject({
      autoEnabled: true,
      frequency: 'monthly',
      monthlyDate: 15,
    })
  })

  it('updateBackupPrefs 只覆蓋指定欄位', () => {
    const next = updateBackupPrefs({ autoEnabled: true, weeklyDay: 3 })
    expect(next.autoEnabled).toBe(true)
    expect(next.weeklyDay).toBe(3)
    expect(next.frequency).toBe('weekly')
  })
})

describe('scheduledBackupDate', () => {
  it('每週排程取本週最近一次（含今天）', () => {
    const tuesday = new Date(2026, 10, 3)
    expect(
      scheduledBackupDate(
        { ...defaultBackupPrefs(), weeklyDay: 2 },
        tuesday,
      ),
    ).toBe('2026-11-03')
    expect(
      scheduledBackupDate(
        { ...defaultBackupPrefs(), weeklyDay: 0 },
        tuesday,
      ),
    ).toBe('2026-11-01')
  })

  it('每月 31 日在二月改用該月最後一天', () => {
    expect(
      scheduledBackupDate(
        { ...defaultBackupPrefs(), frequency: 'monthly', monthlyDate: 31 },
        new Date(2026, 1, 10),
      ),
    ).toBe('2026-02-28')
  })
})

describe('isAutoBackupDue', () => {
  const prefs = defaultBackupPrefs()

  it('未開啟自動備份時不執行', () => {
    expect(
      isAutoBackupDue({ ...prefs, autoEnabled: false }, new Date(2026, 10, 3)),
    ).toBe(false)
  })

  it('尚未到本月排程日時不執行', () => {
    expect(
      isAutoBackupDue(
        {
          ...prefs,
          autoEnabled: true,
          frequency: 'monthly',
          monthlyDate: 15,
        },
        new Date(2026, 10, 3),
      ),
    ).toBe(false)
  })

  it('已過排程日且本期尚未自動備份時要執行', () => {
    expect(
      isAutoBackupDue(
        {
          ...prefs,
          autoEnabled: true,
          frequency: 'monthly',
          monthlyDate: 1,
          lastDownloadedAt: '2026-11-03T08:00:00.000Z',
        },
        new Date(2026, 10, 3, 12),
      ),
    ).toBe(true)
  })

  it('上次自動備份時間無效時仍視為到期', () => {
    expect(
      isAutoBackupDue(
        {
          ...prefs,
          autoEnabled: true,
          weeklyDay: 2,
          lastAutoDownloadedAt: 'not-a-date',
        },
        new Date(2026, 10, 3, 18),
      ),
    ).toBe(true)
  })

  it('本期已自動備份後不再執行；手動下載不擋排程', () => {
    expect(
      isAutoBackupDue(
        {
          ...prefs,
          autoEnabled: true,
          weeklyDay: 2,
          lastAutoDownloadedAt: new Date(2026, 10, 3, 9).toISOString(),
        },
        new Date(2026, 10, 3, 18),
      ),
    ).toBe(false)
  })
})

describe('markBackupDownloaded', () => {
  it('手動下載只寫 lastDownloadedAt', () => {
    const at = new Date('2026-11-03T01:00:00.000Z')
    const next = markBackupDownloaded('manual', at)
    expect(next.lastDownloadedAt).toBe(at.toISOString())
    expect(next.lastAutoDownloadedAt).toBeNull()
  })

  it('自動下載同時寫入兩種時間', () => {
    const at = new Date('2026-11-03T01:00:00.000Z')
    const next = markBackupDownloaded('auto', at)
    expect(next.lastDownloadedAt).toBe(at.toISOString())
    expect(next.lastAutoDownloadedAt).toBe(at.toISOString())
  })
})

describe('formatLastDownloadedAt / weekdayLabel', () => {
  it('沒有或無效時間顯示尚無', () => {
    expect(formatLastDownloadedAt(null)).toBe('尚無')
    expect(formatLastDownloadedAt('not-a-date')).toBe('尚無')
  })

  it('有效時間轉成台灣地區字串', () => {
    const text = formatLastDownloadedAt('2026-11-03T01:00:00.000Z')
    expect(text).not.toBe('尚無')
    expect(text).toContain('2026')
  })

  it('未知星期回退星期日', () => {
    expect(weekdayLabel(1)).toBe('星期一')
    expect(weekdayLabel(99)).toBe('星期日')
  })
})
