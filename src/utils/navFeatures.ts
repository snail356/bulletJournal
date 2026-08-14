import type { AppIconName } from '@/plugins/fontawesome'

export type NavFeatureId =
  | 'today'
  | 'calendar'
  | 'all-tasks'
  | 'labels'
  | 'difficulty-notes'
  | 'toolbox'
  | 'reflections'
  | 'stats'
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
    id: 'labels',
    path: '/settings',
    label: '標籤',
    description: '任務與表單上的標籤選單；標籤內容請到設定的「標籤管理」分頁編輯',
    icon: 'tags',
    showInSidebar: false,
  },
  {
    id: 'difficulty-notes',
    path: '/difficulty-notes',
    label: '困難點資料',
    description: '常用困難點紀錄；關閉後任務上的困難點選單也會隱藏',
    icon: 'clipboard-list',
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
  'all-tasks': true,
  labels: true,
  'difficulty-notes': true,
  toolbox: true,
  reflections: true,
  stats: true,
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
