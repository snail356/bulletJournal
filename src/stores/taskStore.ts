import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { mockLabels, mockTasks } from '@/mock/data'
import type {
  AttachmentOwnerType,
  Label,
  Note,
  SubTask,
  Task,
  TaskStatus,
  TodayProgress,
} from '@/types'
import { createAttachmentFromFile } from '@/utils/attachment'
import { addDays, todayString } from '@/utils/date'
import { generateId } from '@/utils/id'
import {
  LABELS_KEY,
  SELECTED_DATE_KEY,
  TASKS_KEY,
  loadFromStorage,
  saveToStorage,
} from '@/utils/storage'

function cloneTask(task: Task): Task {
  return JSON.parse(JSON.stringify(task)) as Task
}

function sortByCompleted<T extends { completed: boolean }>(items: T[]): T[] {
  const pending = items.filter((i) => !i.completed)
  const done = items.filter((i) => i.completed)
  return [...pending, ...done]
}

export const useTaskStore = defineStore('task', () => {
  const initialized = ref(false)
  const tasks = ref<Task[]>([])
  const labels = ref<Label[]>([])
  const selectedDate = ref(todayString())

  function persist() {
    saveToStorage(TASKS_KEY, tasks.value)
    saveToStorage(LABELS_KEY, labels.value)
    saveToStorage(SELECTED_DATE_KEY, selectedDate.value)
  }

  function init() {
    if (initialized.value) return
    const storedTasks = loadFromStorage<Task[] | null>(TASKS_KEY, null)
    const storedLabels = loadFromStorage<Label[] | null>(LABELS_KEY, null)
    const storedDate = loadFromStorage<string | null>(SELECTED_DATE_KEY, null)

    tasks.value = storedTasks ?? [...mockTasks]
    labels.value = storedLabels ?? [...mockLabels]
    selectedDate.value = storedDate ?? todayString()

    const today = todayString()
    const yesterday = addDays(today, -1)
    carryOverUnfinishedTasks(yesterday, today)

    initialized.value = true
    persist()
  }

  watch([tasks, labels, selectedDate], persist, { deep: true })

  const tasksForSelectedDate = computed(() => getTasksByDate(selectedDate.value))

  function calcProgress(date: string): TodayProgress {
    const dayTasks = tasks.value.filter((t) => t.date === date)
    let total = dayTasks.length
    let completed = dayTasks.filter((t) => t.completed).length
    for (const task of dayTasks) {
      total += task.subtasks.length
      completed += task.subtasks.filter((s) => s.completed).length
    }
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)
    return { total, completed, percentage }
  }

  const todayProgress = computed(() => calcProgress(selectedDate.value))

  function getTasksByDate(date: string): Task[] {
    const list = tasks.value.filter((t) => t.date === date)
    return sortByCompleted([...list])
  }

  function findTask(taskId: string): Task | undefined {
    return tasks.value.find((t) => t.id === taskId)
  }

  function touchTask(task: Task) {
    task.updatedAt = new Date().toISOString()
  }

  function createTask(payload: {
    date: string
    title: string
    status?: TaskStatus
    labels?: string[]
  }): Task {
    const now = new Date().toISOString()
    const task: Task = {
      id: generateId(),
      date: payload.date,
      title: payload.title,
      status: payload.status ?? 'in_progress',
      completed: false,
      subtasks: [],
      notes: [],
      attachments: [],
      labels: payload.labels ?? [],
      createdAt: now,
      updatedAt: now,
    }
    tasks.value.push(task)
    return task
  }

  function updateTask(id: string, payload: Partial<Omit<Task, 'id'>>) {
    const task = findTask(id)
    if (!task) return
    Object.assign(task, payload)
    touchTask(task)
  }

  function deleteTask(id: string) {
    tasks.value = tasks.value.filter((t) => t.id !== id)
  }

  function duplicateTask(taskId: string, targetDate?: string): Task | null {
    const source = findTask(taskId)
    if (!source) return null
    const copy = cloneTask(source)
    const now = new Date().toISOString()
    const newId = generateId()
    copy.id = newId
    copy.date = targetDate ?? source.date
    copy.completed = false
    copy.createdAt = now
    copy.updatedAt = now
    copy.subtasks = copy.subtasks.map((s) => {
      const subId = generateId()
      return {
        ...s,
        id: subId,
        taskId: newId,
        completed: false,
        createdAt: now,
        updatedAt: now,
        attachments: s.attachments.map((a) => ({
          ...a,
          id: generateId(),
          ownerId: subId,
          ownerType: 'subtask' as const,
        })),
      }
    })
    copy.notes = copy.notes.map((n) => {
      const noteId = generateId()
      return {
        ...n,
        id: noteId,
        taskId: newId,
        createdAt: now,
        updatedAt: now,
        attachments: n.attachments.map((a) => ({
          ...a,
          id: generateId(),
          ownerId: noteId,
          ownerType: 'note' as const,
        })),
      }
    })
    copy.attachments = copy.attachments.map((a) => ({
      ...a,
      id: generateId(),
      ownerId: newId,
      ownerType: 'task' as const,
    }))
    tasks.value.push(copy)
    return copy
  }

  function moveTask(taskId: string, newDate: string) {
    updateTask(taskId, { date: newDate })
  }

  function toggleTask(taskId: string) {
    const task = findTask(taskId)
    if (!task) return
    task.completed = !task.completed
    if (task.completed) {
      task.status = 'done'
    } else if (task.status === 'done') {
      task.status = 'in_progress'
    }
    touchTask(task)
    reorderCompletedToBottom(task.date)
  }

  function createSubTask(taskId: string, title: string): SubTask | null {
    const task = findTask(taskId)
    if (!task) return null
    const now = new Date().toISOString()
    const sub: SubTask = {
      id: generateId(),
      taskId,
      title,
      completed: false,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    }
    task.subtasks.push(sub)
    touchTask(task)
    return sub
  }

  function updateSubTask(
    taskId: string,
    subTaskId: string,
    payload: Partial<Pick<SubTask, 'title' | 'completed'>>,
  ) {
    const task = findTask(taskId)
    if (!task) return
    const sub = task.subtasks.find((s) => s.id === subTaskId)
    if (!sub) return
    Object.assign(sub, payload)
    sub.updatedAt = new Date().toISOString()
    touchTask(task)
  }

  function deleteSubTask(taskId: string, subTaskId: string) {
    const task = findTask(taskId)
    if (!task) return
    task.subtasks = task.subtasks.filter((s) => s.id !== subTaskId)
    touchTask(task)
  }

  function toggleSubTask(taskId: string, subTaskId: string) {
    const task = findTask(taskId)
    if (!task) return
    const sub = task.subtasks.find((s) => s.id === subTaskId)
    if (!sub) return
    sub.completed = !sub.completed
    sub.updatedAt = new Date().toISOString()
    task.subtasks = sortByCompleted(task.subtasks)
    touchTask(task)
  }

  function createNote(taskId: string, content: string, color: Note['color'] = 'purple'): Note | null {
    const task = findTask(taskId)
    if (!task) return null
    const now = new Date().toISOString()
    const note: Note = {
      id: generateId(),
      taskId,
      content,
      color,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    }
    task.notes.push(note)
    touchTask(task)
    return note
  }

  function updateNote(
    taskId: string,
    noteId: string,
    payload: Partial<Pick<Note, 'content' | 'color'>>,
  ) {
    const task = findTask(taskId)
    if (!task) return
    const note = task.notes.find((n) => n.id === noteId)
    if (!note) return
    Object.assign(note, payload)
    note.updatedAt = new Date().toISOString()
    touchTask(task)
  }

  function deleteNote(taskId: string, noteId: string) {
    const task = findTask(taskId)
    if (!task) return
    task.notes = task.notes.filter((n) => n.id !== noteId)
    touchTask(task)
  }

  async function addAttachment(
    ownerType: AttachmentOwnerType,
    ownerId: string,
    file: File,
  ) {
    const attachment = await createAttachmentFromFile(ownerType, ownerId, file)

    if (ownerType === 'task') {
      const task = findTask(ownerId)
      if (!task) return attachment
      task.attachments.push(attachment)
      touchTask(task)
    } else if (ownerType === 'subtask') {
      for (const task of tasks.value) {
        const sub = task.subtasks.find((s) => s.id === ownerId)
        if (sub) {
          sub.attachments.push(attachment)
          touchTask(task)
          break
        }
      }
    } else {
      for (const task of tasks.value) {
        const note = task.notes.find((n) => n.id === ownerId)
        if (note) {
          note.attachments.push(attachment)
          touchTask(task)
          break
        }
      }
    }
    return attachment
  }

  function deleteAttachment(attachmentId: string) {
    for (const task of tasks.value) {
      task.attachments = task.attachments.filter((a) => a.id !== attachmentId)
      for (const sub of task.subtasks) {
        sub.attachments = sub.attachments.filter((a) => a.id !== attachmentId)
      }
      for (const note of task.notes) {
        note.attachments = note.attachments.filter((a) => a.id !== attachmentId)
      }
    }
  }

  function carryOverUnfinishedTasks(fromDate: string, toDate: string) {
    if (fromDate === toDate) return

    const unfinished = tasks.value.filter(
      (t) => t.date === fromDate && !t.completed,
    )

    for (const source of unfinished) {
      const alreadyCarried = tasks.value.some(
        (t) =>
          t.date === toDate &&
          t.carriedFromDate === fromDate &&
          t.title === source.title,
      )
      if (alreadyCarried) continue

      const now = new Date().toISOString()
      const newId = generateId()
      const carried: Task = {
        ...cloneTask(source),
        id: newId,
        date: toDate,
        carriedFromDate: fromDate,
        createdAt: now,
        updatedAt: now,
        subtasks: source.subtasks.map((s) => {
          const subId = generateId()
          return {
            ...s,
            id: subId,
            taskId: newId,
            attachments: s.attachments.map((a) => ({
              ...a,
              id: generateId(),
              ownerId: subId,
            })),
          }
        }),
        notes: source.notes.map((n) => {
          const noteId = generateId()
          return {
            ...n,
            id: noteId,
            taskId: newId,
            attachments: n.attachments.map((a) => ({
              ...a,
              id: generateId(),
              ownerId: noteId,
            })),
          }
        }),
        attachments: source.attachments.map((a) => ({
          ...a,
          id: generateId(),
          ownerId: newId,
        })),
      }
      tasks.value.push(carried)
    }
  }

  function reorderCompletedToBottom(date?: string) {
    if (date) {
      const dayTasks = tasks.value.filter((t) => t.date === date)
      const others = tasks.value.filter((t) => t.date !== date)
      tasks.value = [...others, ...sortByCompleted(dayTasks)]
      return
    }
    const grouped = new Map<string, Task[]>()
    for (const task of tasks.value) {
      const list = grouped.get(task.date) ?? []
      list.push(task)
      grouped.set(task.date, list)
    }
    tasks.value = Array.from(grouped.entries()).flatMap(([, list]) =>
      sortByCompleted(list),
    )
  }

  function getTodayProgress(date?: string): TodayProgress {
    return calcProgress(date ?? selectedDate.value)
  }

  function setSelectedDate(date: string) {
    selectedDate.value = date
  }

  function createLabel(name: string, color: string): Label {
    const label: Label = { id: generateId(), name, color }
    labels.value.push(label)
    return label
  }

  function updateLabel(id: string, payload: Partial<Pick<Label, 'name' | 'color'>>) {
    const label = labels.value.find((l) => l.id === id)
    if (label) Object.assign(label, payload)
  }

  function deleteLabel(id: string) {
    labels.value = labels.value.filter((l) => l.id !== id)
    tasks.value.forEach((t) => {
      t.labels = t.labels.filter((lid) => lid !== id)
    })
  }

  function getAllTasksFiltered(status?: TaskStatus | 'all') {
    let list = [...tasks.value]
    if (status && status !== 'all') {
      list = list.filter((t) => t.status === status)
    }
    return list.sort((a, b) => b.date.localeCompare(a.date))
  }

  function getTaskStats() {
    const byStatus: Record<string, number> = {}
    for (const task of tasks.value) {
      byStatus[task.status] = (byStatus[task.status] ?? 0) + 1
    }
    return {
      total: tasks.value.length,
      completed: tasks.value.filter((t) => t.completed).length,
      byStatus,
    }
  }

  return {
    tasks,
    labels,
    selectedDate,
    tasksForSelectedDate,
    todayProgress,
    init,
    getTasksByDate,
    createTask,
    updateTask,
    deleteTask,
    duplicateTask,
    moveTask,
    toggleTask,
    createSubTask,
    updateSubTask,
    deleteSubTask,
    toggleSubTask,
    createNote,
    updateNote,
    deleteNote,
    addAttachment,
    deleteAttachment,
    carryOverUnfinishedTasks,
    reorderCompletedToBottom,
    getTodayProgress,
    setSelectedDate,
    createLabel,
    updateLabel,
    deleteLabel,
    getAllTasksFiltered,
    getTaskStats,
    findTask,
  }
})
