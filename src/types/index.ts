export type TaskStatus =
  | 'in_progress'
  | 'pending_test'
  | 'pending_fix'
  | 'waiting_pm'
  | 'waiting_release'
  | 'paused'
  | 'done'

export type AttachmentOwnerType = 'task' | 'subtask' | 'note'

export interface Attachment {
  id: string
  ownerType: AttachmentOwnerType
  ownerId: string
  fileName: string
  mimeType: string
  url: string
  thumbnailUrl: string
  createdAt: string
}

export interface Note {
  id: string
  taskId: string
  content: string
  color: 'purple' | 'orange' | 'green' | 'blue' | 'gray'
  attachments: Attachment[]
  createdAt: string
  updatedAt: string
}

export interface SubTask {
  id: string
  taskId: string
  title: string
  note: string
  completed: boolean
  attachments: Attachment[]
  createdAt: string
  updatedAt: string
}

export interface MigrationRecord {
  fromDate: string
  toDate: string
  migratedAt: string
}

export type MigrationReviewActionType = 'migrate' | 'keep' | 'complete'

export interface MigrationReviewAction {
  taskId: string
  action: MigrationReviewActionType
  targetDate?: string
}

export interface MigrationCandidate {
  task: Task
  overdueFrom: string
  daysOverdue: number
}

export interface MigrationReviewState {
  snoozedUntil: string | null
  keptTodayTaskIds: Record<string, string[]>
  lastReviewedDate: string | null
}

export interface Task {
  id: string
  /** 計畫執行日期（scheduled date） */
  date: string
  title: string
  status: TaskStatus
  completed: boolean
  subtasks: SubTask[]
  notes: Note[]
  attachments: Attachment[]
  labels: string[]
  migrationHistory: MigrationRecord[]
  createdAt: string
  updatedAt: string
}

/** 某日頁面上的任務呈現（含已遷移的歷史連結） */
export interface TaskDayView {
  task: Task
  migratedAway: boolean
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface TodayProgress {
  total: number
  completed: number
  percentage: number
}
