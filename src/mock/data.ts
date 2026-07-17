import type { Label, Task } from '@/types'
import { addDays, todayString } from '@/utils/date'
import { generateId } from '@/utils/id'

const today = todayString()
const yesterday = addDays(today, -1)

const placeholderImage =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">
      <rect fill="#ede9fe" width="120" height="80" rx="8"/>
      <text x="60" y="44" text-anchor="middle" fill="#7c3aed" font-size="12" font-family="sans-serif">Mock</text>
    </svg>`,
  )

export const mockLabels: Label[] = [
  { id: 'label-1', name: '前端', color: '#7c3aed' },
  { id: 'label-2', name: '後端', color: '#3b82f6' },
  { id: 'label-3', name: '設計', color: '#f97316' },
  { id: 'label-4', name: '緊急', color: '#ef4444' },
]

export const mockTasks: Task[] = [
  {
    id: 'task-1',
    date: today,
    title: '完成 Bullet Journal 首頁版面',
    status: 'in_progress',
    statusHours: 2.5,
    difficultyNote: 'Sidebar 與日曆元件互動整合',
    bodyContent: '今日目標：完成首頁核心版面，確保 Sidebar、日曆與任務列表可正常互動。',
    bodyContentType: 'text',
    completed: false,
    labels: ['label-1'],
    migrationHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attachments: [
      {
        id: 'att-1',
        ownerType: 'task',
        ownerId: 'task-1',
        fileName: 'layout-mock.png',
        mimeType: 'image/svg+xml',
        url: placeholderImage,
        thumbnailUrl: placeholderImage,
        createdAt: new Date().toISOString(),
      },
    ],
    subtasks: [
      {
        id: 'sub-1',
        taskId: 'task-1',
        title: 'Sidebar 與日曆元件',
        note: '',
        noteContentType: 'text',
        completed: true,
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'sub-2',
        taskId: 'task-1',
        title: '任務卡片互動',
        note: '需支援拖曳排序與右鍵選單',
        noteContentType: 'text',
        completed: false,
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    notes: [
      {
        id: 'note-1',
        taskId: 'task-1',
        content: '優先完成 TodayView 的完整互動，包含貼圖與排序。',
        contentType: 'text',
        color: 'purple',
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'task-2',
    date: today,
    title: '修正登入頁 RWD 問題',
    status: 'pending_fix',
    statusHours: 1.5,
    difficultyNote: 'flex 容器 min-width 溢出',
    bodyContent: '',
    bodyContentType: 'text',
    completed: false,
    labels: ['label-1', 'label-4'],
    migrationHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attachments: [],
    subtasks: [
      {
        id: 'sub-3',
        taskId: 'task-2',
        title: '手機版按鈕溢出',
        note: '',
        noteContentType: 'text',
        completed: false,
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    notes: [],
  },
  {
    id: 'task-3',
    date: today,
    title: '撰寫 API 文件',
    status: 'done',
    statusHours: 3,
    difficultyNote: '',
    bodyContent: '',
    bodyContentType: 'text',
    completed: true,
    labels: ['label-2'],
    migrationHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attachments: [],
    subtasks: [],
    notes: [],
  },
  {
    id: 'task-4',
    date: yesterday,
    title: '設計稿審核回饋整理',
    status: 'waiting_pm',
    statusHours: null,
    difficultyNote: '等待 PM 確認配色方案',
    bodyContent: '',
    bodyContentType: 'text',
    completed: false,
    labels: ['label-3'],
    migrationHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attachments: [],
    subtasks: [
      {
        id: 'sub-4',
        taskId: 'task-4',
        title: '整理 PM 留言',
        note: '',
        noteContentType: 'text',
        completed: false,
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    notes: [
      {
        id: 'note-2',
        taskId: 'task-4',
        content: '等待 PM 確認配色方案。',
        contentType: 'text',
        color: 'orange',
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'task-5',
    date: addDays(today, -3),
    title: '上週衝刺回顧',
    status: 'done',
    statusHours: 1,
    difficultyNote: '',
    bodyContent: '',
    bodyContentType: 'text',
    completed: true,
    labels: ['label-1'],
    migrationHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attachments: [],
    subtasks: [],
    notes: [],
  },
]

export function createEmptyTask(date: string, title: string): Task {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    date,
    title,
    status: 'in_progress',
    statusHours: null,
    difficultyNote: '',
    bodyContent: '',
    bodyContentType: 'text',
    completed: false,
    subtasks: [],
    notes: [],
    attachments: [],
    labels: [],
    migrationHistory: [],
    createdAt: now,
    updatedAt: now,
  }
}
