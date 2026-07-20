export type TaskStatus =
  | 'in_progress'
  | 'pending_test'
  | 'pending_fix'
  | 'waiting_pm'
  | 'waiting_release'
  | 'paused'
  | 'done'

export type AttachmentOwnerType = 'task' | 'subtask' | 'note'

/** 輸入區內容格式：text＝純文字；code＝程式碼區塊；markdown＝Markdown 渲染 */
export type ContentFormat = 'text' | 'code' | 'markdown'

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
  contentType: ContentFormat
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
  noteContentType: ContentFormat
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

export interface DifficultyNoteRecord {
  id: string
  content: string
  usageCount: number
  createdAt: string
  lastUsedAt: string
}

/** 每日回顧日誌（一天一份） */
export interface DailyReflection {
  id: string
  date: string
  morningContent: string
  afternoon1to3Content: string
  afternoonAfter3Content: string
  /** 當日總結 */
  summaryContent: string
  /** AI 主管建議 */
  aiManagerAdvice: string
  /** AI 建議產生時間 */
  aiGeneratedAt: string | null
  /** draft＝暫存（仍可在回顧日誌查看並呼叫 AI）；submitted＝完成提交 */
  status: 'draft' | 'submitted'
  createdAt: string
  updatedAt: string
}

export type TodayJournalState = 'new' | 'edit' | 'done'

export interface DailyReflectionInput {
  morningContent: string
  afternoon1to3Content: string
  afternoonAfter3Content: string
  summaryContent: string
}

export interface ReflectionPromptState {
  snoozedUntil: string | null
  lastReflectedDate: string | null
}

/** Gemini API 本機呼叫用量（非 Google 帳單） */
export interface GeminiUsageState {
  totalSuccessCalls: number
  lastCalledAt: string | null
  lastError: string | null
}

export interface Task {
  id: string
  /** 計畫執行日期（scheduled date） */
  date: string
  title: string
  status: TaskStatus
  /** 此狀態累計／估計時數 */
  statusHours: number | null
  /** 困難點備註（可從歷史紀錄選取） */
  difficultyNote: string
  /** 主任務內容區（唯一，不可新增刪除） */
  bodyContent: string
  bodyContentType: ContentFormat
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

/** 任務狀態下拉選單的標籤項目 */
export interface StatusItem {
  id: TaskStatus
  name: string
  color: string
  bgColor: string
}

export interface TodayProgress {
  total: number
  completed: number
  percentage: number
}
