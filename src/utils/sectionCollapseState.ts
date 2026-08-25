/** Session-scoped collapse state so remounting after route changes keeps UI. */

const bodyExpandedByTaskId = new Map<string, boolean>()
const notesExpandedByTaskId = new Map<string, boolean>()
const noteCollapsedById = new Map<string, boolean>()
const subtaskNoteExpandedById = new Map<string, boolean>()
const subtasksExpandedByTaskId = new Map<string, boolean>()

export function getBodyExpanded(taskId: string, fallback: boolean): boolean {
  return bodyExpandedByTaskId.has(taskId)
    ? bodyExpandedByTaskId.get(taskId)!
    : fallback
}

export function setBodyExpanded(taskId: string, expanded: boolean): void {
  bodyExpandedByTaskId.set(taskId, expanded)
}

export function getNotesExpanded(taskId: string, fallback: boolean): boolean {
  return notesExpandedByTaskId.has(taskId)
    ? notesExpandedByTaskId.get(taskId)!
    : fallback
}

export function setNotesExpanded(taskId: string, expanded: boolean): void {
  notesExpandedByTaskId.set(taskId, expanded)
}

export function getNoteCollapsed(noteId: string, fallback: boolean): boolean {
  return noteCollapsedById.has(noteId)
    ? noteCollapsedById.get(noteId)!
    : fallback
}

export function setNoteCollapsed(noteId: string, collapsed: boolean): void {
  noteCollapsedById.set(noteId, collapsed)
}

export function getSubtaskNoteExpanded(
  subtaskId: string,
  fallback: boolean,
): boolean {
  return subtaskNoteExpandedById.has(subtaskId)
    ? subtaskNoteExpandedById.get(subtaskId)!
    : fallback
}

export function setSubtaskNoteExpanded(
  subtaskId: string,
  expanded: boolean,
): void {
  subtaskNoteExpandedById.set(subtaskId, expanded)
}

export function getSubtasksExpanded(
  taskId: string,
  fallback: boolean,
): boolean {
  return subtasksExpandedByTaskId.has(taskId)
    ? subtasksExpandedByTaskId.get(taskId)!
    : fallback
}

export function setSubtasksExpanded(
  taskId: string,
  expanded: boolean,
): void {
  subtasksExpandedByTaskId.set(taskId, expanded)
}
