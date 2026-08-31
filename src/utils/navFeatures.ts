import type { AppIconName } from '@/plugins/fontawesome'

export type NavFeatureId =
  | 'today'
  | 'calendar'
  | 'all-tasks'
  | 'toolbox'
  | 'reflections'
  | 'stats'
  | 'xiaoguli'
  | 'settings'

export type NavFeatureVisibility = Record<NavFeatureId, boolean>

export interface NavFeature {
  id: NavFeatureId
  path: string
  label: string
  description: string
  icon: AppIconName
  /** 設定永遠可用，避免關掉後無法再開其他功能 */
  alwaysEnabled?: boolean
  /** 是否顯示於左側選單；管理類功能可改放設定分頁 */
  showInSidebar?: boolean
}

export const NAV_FEATURES: NavFeature[] = [
  {
    id: 'today',
    path: '/today',
    label: '今日任務',
    description: '當日任務清單與進度；關閉後側邊欄今日進度也會隱藏',
    icon: 'sun',
  },
  {
    id: 'calendar',
    path: '/calendar',
    label: '日曆',
    description: '以日曆檢視與安排任務',
    icon: 'calendar',
  },
  {
    id: 'all-tasks',
    path: '/tasks',
    label: '所有任務',
    description: '全部任務列表與篩選',
    icon: 'list-check',
  },
  {
    id: 'toolbox',
    path: '/toolbox',
    label: '工具箱與思考清單',
    description: '決策時可對照的思考清單',
    icon: 'toolbox',
  },
  {
    id: 'reflections',
    path: '/reflections',
    label: '回顧日誌',
    description: '每日回顧與 AI 主管建議；關閉後今日頁的日誌按鈕與提醒彈窗也會隱藏',
    icon: 'file-lines',
  },
  {
    id: 'stats',
    path: '/stats',
    label: '統計分析',
    description: '任務完成與狀態統計',
    icon: 'chart-column',
  },
  {
    id: 'xiaoguli',
    path: '/xiaoguli',
    label: '小股力',
    description: '查找台股、加入最愛，並動態顯示股價、配息與除權息日',
    icon: 'chart-line',
  },
  {
    id: 'settings',
    path: '/settings',
    label: '設定',
    description: '應用程式偏好與資料管理',
    icon: 'gear',
    alwaysEnabled: true,
  },
]

export const defaultNavFeatureVisibility: NavFeatureVisibility = {
  today: true,
  calendar: true,
  'all-tasks': false,
  toolbox: true,
  reflections: false,
  stats: false,
  xiaoguli: true,
  settings: true,
}

export function normalizeNavFeatureVisibility(
  raw: Partial<NavFeatureVisibility> | null | undefined,
): NavFeatureVisibility {
  return {
    ...defaultNavFeatureVisibility,
    ...raw,
    settings: true,
  }
}

export const defaultNavFeatureOrder: NavFeatureId[] = NAV_FEATURES.map((feature) => feature.id)

export function normalizeNavFeatureOrder(raw: unknown): NavFeatureId[] {
  const known = new Set<NavFeatureId>(NAV_FEATURES.map((feature) => feature.id))
  const ordered: NavFeatureId[] = []

  if (Array.isArray(raw)) {
    for (const id of raw) {
      if (typeof id !== 'string' || !known.has(id as NavFeatureId)) continue
      const featureId = id as NavFeatureId
      if (!ordered.includes(featureId)) ordered.push(featureId)
    }
  }

  for (const feature of NAV_FEATURES) {
    if (ordered.includes(feature.id)) continue
    if (feature.id === 'settings') {
      ordered.push(feature.id)
      continue
    }
    const settingsIdx = ordered.indexOf('settings')
    if (settingsIdx >= 0) ordered.splice(settingsIdx, 0, feature.id)
    else ordered.push(feature.id)
  }

  return ordered
}

export function getOrderedNavFeatures(order: NavFeatureId[]): NavFeature[] {
  const byId = new Map(NAV_FEATURES.map((feature) => [feature.id, feature]))
  return order
    .map((id) => byId.get(id))
    .filter((feature): feature is NavFeature => Boolean(feature))
}
