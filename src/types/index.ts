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

export interface Task {
  id: string
  date: string
  title: string
  status: TaskStatus
  completed: boolean
  subtasks: SubTask[]
  notes: Note[]
  attachments: Attachment[]
  labels: string[]
  carriedFromDate?: string
  createdAt: string
  updatedAt: string
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
