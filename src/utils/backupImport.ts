import JSZip from 'jszip'
import type {
  Attachment,
  AttachmentOwnerType,
  ContentFormat,
  Label,
  Note,
  StatusItem,
  SubTask,
  Task,
  TaskStatus,
  ToolboxItem,
  ToolboxList,
} from '@/types'
import {
  BACKUP_JSON_FILE,
  type BackupFileAttachment,
  type BackupFileTask,
  type BackupPayload,
  type BackupSource,
} from '@/utils/backup'
import { resolveContentType } from '@/utils/detectContentType'
import { generateId } from '@/utils/id'
import { DEFAULT_LABEL_COLOR } from '@/utils/labelColors'
import {
  ALL_STATUSES,
  getStatusBgForColor,
  STATUS_LABELS,
} from '@/utils/status'

const NOTE_COLOR_FROM_LABEL: Record<string, Note['color']> = {
  紫: 'purple',
  橙: 'orange',
  綠: 'green',
  藍: 'blue',
  灰: 'gray',
  purple: 'purple',
  orange: 'orange',
  green: 'green',
  blue: 'blue',
  gray: 'gray',
}

const TASK_FOLDER = '任務/'
const TOOLBOX_FOLDER = '工具箱與思考清單/'
const PHOTO_FOLDER = 'photos/'
const LABELS_FILE = '標籤.md'

type PhotoIndex = Map<string, string>

function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

function stripCommonRoot(paths: string[]): string {
  const files = paths.filter((path) => path && !path.endsWith('/'))
  if (!files.length) return ''
  const top = files[0].split('/')[0]
  if (!top) return ''
  const prefix = `${top}/`
  return files.every((path) => path.startsWith(prefix)) ? prefix : ''
}

async function readZipEntries(
  file: File,
): Promise<Map<string, JSZip.JSZipObject>> {
  const zip = await JSZip.loadAsync(file)
  const rawPaths = Object.keys(zip.files).map(normalizeZipPath)
  const root = stripCommonRoot(rawPaths)
  const entries = new Map<string, JSZip.JSZipObject>()
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const path = normalizeZipPath(name).slice(root.length)
    if (path) entries.set(path, entry)
  }
  return entries
}

function findEntry(
  entries: Map<string, JSZip.JSZipObject>,
  name: string,
): JSZip.JSZipObject | undefined {
  const direct = entries.get(name)
  if (direct) return direct
  const lower = name.toLowerCase()
  let best: { path: string; entry: JSZip.JSZipObject } | undefined
  for (const [path, entry] of entries) {
    if (path === name || path.toLowerCase() === lower || path.endsWith(`/${name}`)) {
      if (!best || path.length < best.path.length) best = { path, entry }
    }
  }
  return best?.entry
}

function filesInFolder(
  entries: Map<string, JSZip.JSZipObject>,
  folder: string,
  ext: string,
): Array<[string, JSZip.JSZipObject]> {
  const prefix = folder.endsWith('/') ? folder : `${folder}/`
  return [...entries.entries()].filter(([path]) => {
    if (!path.startsWith(prefix) || !path.toLowerCase().endsWith(ext)) return false
    const base = path.slice(path.lastIndexOf('/') + 1).toLowerCase()
    return base !== 'readme.md'
  })
}

function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'webp') return 'image/webp'
  return 'application/octet-stream'
}

function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy.buffer], { type })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function loadPhotos(
  entries: Map<string, JSZip.JSZipObject>,
): Promise<PhotoIndex> {
  const index: PhotoIndex = new Map()
  const files = [...entries.entries()].filter(([path]) =>
    path.startsWith(PHOTO_FOLDER) && /\.(webp|png|jpe?g|gif|svg|bin)$/i.test(path),
  )

  for (const [path, entry] of files) {
    const bytes = await entry.async('uint8array')
    const mime = mimeFromPath(path)
    const dataUrl = await blobToDataUrl(bytesToBlob(bytes, mime))
    const base = path.slice(path.lastIndexOf('/') + 1)
    const id = base.replace(/\.[^.]+$/, '')
    index.set(path, dataUrl)
    index.set(base, dataUrl)
    index.set(id, dataUrl)
  }
  return index
}

function lookupPhoto(photos: PhotoIndex, rawPath: string): string | undefined {
  const cleaned = rawPath.replace(/\\/g, '/').replace(/^\.\.\//, '').replace(/^\.\//, '')
  return (
    photos.get(cleaned) ??
    photos.get(cleaned.slice(cleaned.lastIndexOf('/') + 1)) ??
    photos.get(cleaned.replace(/\.[^.]+$/, '').slice(cleaned.lastIndexOf('/') + 1))
  )
}

function isEmptyPlaceholder(value: string): boolean {
  const trimmed = value.trim()
  return !trimmed || /^_（.*）_$/.test(trimmed) || /^_尚無/.test(trimmed)
}

function unescapeTableCell(value: string): string {
  return value.replace(/\\\|/g, '|').trim()
}

function parseTableRows(markdown: string): string[][] {
  const rows: string[][] = []
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue
    if (/^\|?\s*:?-{3,}/.test(trimmed)) continue
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((cell) => unescapeTableCell(cell))
    if (cells.length) rows.push(cells)
  }
  return rows
}

function parseKeyValueTable(markdown: string): Record<string, string> {
  const rows = parseTableRows(markdown)
  const data = rows[0]?.[0] === '欄位' ? rows.slice(1) : rows
  const map: Record<string, string> = {}
  for (const [key, value] of data) {
    if (key) map[key] = value ?? ''
  }
  return map
}

function splitByHeading(
  markdown: string,
  level: number,
): Array<{ heading: string; body: string }> {
  const re = new RegExp(`^#{${level}}\\s+(.+)$`, 'gm')
  const hits: Array<{ heading: string; start: number; end: number }> = []
  let match: RegExpExecArray | null
  while ((match = re.exec(markdown))) {
    hits.push({
      heading: match[1].trim(),
      start: match.index,
      end: match.index + match[0].length,
    })
  }
  return hits.map((hit, index) => ({
    heading: hit.heading,
    body: markdown.slice(hit.end, hits[index + 1]?.start).trim(),
  }))
}

function parseStoredContent(raw: string): { content: string; type: ContentFormat } {
  const trimmed = raw.trim()
  if (isEmptyPlaceholder(trimmed)) return { content: '', type: 'text' }
  const fenced = trimmed.match(/^```[\w-]*\r?\n([\s\S]*)\r?\n```$/)
  if (fenced) return { content: fenced[1], type: 'code' }
  return { content: trimmed, type: resolveContentType(trimmed) }
}

function parseFlexibleDateTime(value: string | undefined): string {
  const raw = value?.trim()
  if (!raw || raw === '—') return new Date().toISOString()
  const iso = new Date(raw)
  if (!Number.isNaN(iso.getTime())) return iso.toISOString()
  return new Date().toISOString()
}

function parseHours(value: string | undefined): number | null {
  const raw = value?.trim()
  if (!raw || raw === '—' || raw === '-') return null
  const num = Number.parseFloat(raw)
  return Number.isFinite(num) ? num : null
}

function parseStatus(
  value: string | undefined,
  statusItems: StatusItem[],
): TaskStatus {
  const raw = value?.trim()
  if (!raw || raw === '—') return 'in_progress'
  if (ALL_STATUSES.includes(raw as TaskStatus)) return raw as TaskStatus
  const byName = statusItems.find((item) => item.name === raw)
  if (byName) return byName.id
  const byLabel = (Object.entries(STATUS_LABELS) as Array<[TaskStatus, string]>).find(
    ([, name]) => name === raw,
  )
  return byLabel?.[0] ?? 'in_progress'
}

function parseMdImages(text: string): Array<{ alt: string; path: string }> {
  const images: Array<{ alt: string; path: string }> = []
  const re = /!\[([^\]]*)\]\(\s*<?([^>\s)]+)>?\s*\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    images.push({ alt: match[1], path: match[2] })
  }
  return images
}

function stripImageLines(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(\s*<?([^>\s)]+)>?\s*\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function attachmentFromImage(
  image: { alt: string; path: string },
  ownerType: AttachmentOwnerType,
  ownerId: string,
  photos: PhotoIndex,
  createdAt: string,
): Attachment | null {
  const url = lookupPhoto(photos, image.path)
  if (!url) return null
  const base = image.path.slice(image.path.lastIndexOf('/') + 1)
  const id = base.replace(/\.[^.]+$/, '') || generateId()
  return {
    id,
    ownerType,
    ownerId,
    fileName: image.alt || base || 'image.webp',
    mimeType: mimeFromPath(image.path),
    url,
    thumbnailUrl: url,
    createdAt,
  }
}

function hydrateBackupAttachment(
  item: BackupFileAttachment,
  photos: PhotoIndex,
  fallbackOwnerType: AttachmentOwnerType,
  fallbackOwnerId: string,
): Attachment | null {
  const url = item.file ? lookupPhoto(photos, item.file) : lookupPhoto(photos, item.id)
  if (!url) return null
  return {
    id: item.id || generateId(),
    ownerType: item.ownerType || fallbackOwnerType,
    ownerId: item.ownerId || fallbackOwnerId,
    fileName: item.fileName || 'image.webp',
    mimeType: item.mimeType || mimeFromPath(item.file || ''),
    url,
    thumbnailUrl: url,
    createdAt: item.createdAt || new Date().toISOString(),
  }
}

function parseLabelNames(value: string | undefined): string[] {
  const raw = value?.trim()
  if (!raw || raw === '—') return []
  return raw
    .split(/[、,]/)
    .map((name) => name.trim())
    .filter(Boolean)
}

function parseSubTasks(
  body: string,
  taskId: string,
  photos: PhotoIndex,
  createdAt: string,
): SubTask[] {
  const lines = body.split(/\r?\n/)
  const groups: Array<{ completed: boolean; title: string; rest: string[] }> = []
  let current: { completed: boolean; title: string; rest: string[] } | null = null

  const flush = () => {
    if (current) groups.push(current)
    current = null
  }

  for (const line of lines) {
    const match = line.match(/^- \[([ xX])\] (.*)$/)
    if (match) {
      flush()
      current = {
        completed: match[1].toLowerCase() === 'x',
        title: match[2].trim() || '未命名子任務',
        rest: [],
      }
      continue
    }
    if (current) current.rest.push(line)
  }
  flush()

  return groups.map((group) => {
    const id = generateId()
    const rest = group.rest
      .map((line) => line.replace(/^ {2}/, ''))
      .join('\n')
    const images = parseMdImages(rest)
    const noteRaw = stripImageLines(rest)
    const note = parseStoredContent(noteRaw)
    return {
      id,
      taskId,
      title: group.title,
      note: note.content,
      noteContentType: note.type,
      completed: group.completed,
      attachments: images
        .map((image) => attachmentFromImage(image, 'subtask', id, photos, createdAt))
        .filter((item): item is Attachment => Boolean(item)),
      createdAt,
      updatedAt: createdAt,
    }
  })
}

function parseNotes(
  body: string,
  taskId: string,
  photos: PhotoIndex,
  createdAt: string,
): Note[] {
  return splitByHeading(body, 3).map((section) => {
    const colorKey = section.heading.match(/（([^）]+)）/)?.[1] ?? 'gray'
    const color = NOTE_COLOR_FROM_LABEL[colorKey] ?? 'gray'
    const images = parseMdImages(section.body)
    const parsed = parseStoredContent(stripImageLines(section.body))
    const id = generateId()
    return {
      id,
      taskId,
      content: parsed.content,
      contentType: parsed.type,
      color,
      attachments: images
        .map((image) => attachmentFromImage(image, 'note', id, photos, createdAt))
        .filter((item): item is Attachment => Boolean(item)),
      createdAt,
      updatedAt: createdAt,
    }
  })
}

function parseMigrations(body: string): Task['migrationHistory'] {
  const records: Task['migrationHistory'] = []
  const re =
    /^- `(\d{4}-\d{2}-\d{2})`\s*(?:→|->)\s*`(\d{4}-\d{2}-\d{2})`（(.+)）/
  for (const line of body.split(/\r?\n/)) {
    const match = line.trim().match(re)
    if (!match) continue
    records.push({
      fromDate: match[1],
      toDate: match[2],
      migratedAt: parseFlexibleDateTime(match[3]),
    })
  }
  return records
}

function parseTaskMarkdown(
  markdown: string,
  labelsByName: Map<string, Label>,
  statusItems: StatusItem[],
  photos: PhotoIndex,
): Task {
  const firstH2 = markdown.search(/^##\s+/m)
  const preamble = (firstH2 === -1 ? markdown : markdown.slice(0, firstH2)).trim()
  const title = preamble.match(/^#\s+(.+)$/m)?.[1]?.trim() || '未命名任務'
  const meta = parseKeyValueTable(preamble)
  const sections = Object.fromEntries(
    splitByHeading(firstH2 === -1 ? '' : markdown.slice(firstH2), 2).map((section) => [
      section.heading,
      section.body,
    ]),
  )
  const id = generateId()
  const createdAt = parseFlexibleDateTime(meta['建立時間'])
  const updatedAt = parseFlexibleDateTime(meta['更新時間'])
  const date = /^\d{4}-\d{2}-\d{2}$/.test(meta['日期'] ?? '')
    ? meta['日期']
    : new Date().toISOString().slice(0, 10)
  const body = parseStoredContent(sections['內容'] ?? '')
  const taskPhotos = parseMdImages(sections['照片'] ?? '')

  return {
    id,
    date,
    title,
    status: parseStatus(meta['狀態'], statusItems),
    statusHours: parseHours(meta['狀態時數']),
    difficultyNote: meta['困難點'] && meta['困難點'] !== '—' ? meta['困難點'] : '',
    bodyContent: body.content,
    bodyContentType: body.type,
    completed: meta['完成'] === '是',
    subtasks: parseSubTasks(sections['子任務'] ?? '', id, photos, updatedAt),
    notes: parseNotes(sections['備註'] ?? '', id, photos, updatedAt),
    attachments: taskPhotos
      .map((image) => attachmentFromImage(image, 'task', id, photos, createdAt))
      .filter((item): item is Attachment => Boolean(item)),
    labels: parseLabelNames(meta['標籤'])
      .map((name) => labelsByName.get(name)?.id)
      .filter((labelId): labelId is string => Boolean(labelId)),
    migrationHistory: parseMigrations(sections['遷移紀錄'] ?? ''),
    createdAt,
    updatedAt,
  }
}

function parseToolboxMarkdown(markdown: string): ToolboxList {
  const firstH2 = markdown.search(/^##\s+/m)
  const preamble = (firstH2 === -1 ? markdown : markdown.slice(0, firstH2)).trim()
  const title = preamble.match(/^#\s+(.+)$/m)?.[1]?.trim() || '未命名清單'
  const meta = parseKeyValueTable(preamble)
  const sections = Object.fromEntries(
    splitByHeading(firstH2 === -1 ? '' : markdown.slice(firstH2), 2).map((section) => [
      section.heading,
      section.body,
    ]),
  )
  const createdAt = parseFlexibleDateTime(meta['建立時間'])
  const updatedAt = parseFlexibleDateTime(meta['更新時間'])
  const items: ToolboxItem[] = splitByHeading(sections['思考點'] ?? '', 3).map(
    (section) => {
      const parsed = parseStoredContent(section.body)
      const now = updatedAt
      return {
        id: generateId(),
        content: parsed.content,
        contentType: parsed.type,
        createdAt: now,
        updatedAt: now,
      }
    },
  )

  return {
    id: generateId(),
    title,
    purpose: isEmptyPlaceholder(sections['何時使用'] ?? '')
      ? ''
      : (sections['何時使用'] ?? '').trim(),
    items,
    createdAt,
    updatedAt,
  }
}

function parseLabelsMarkdown(markdown: string): {
  labels: Label[]
  statusItems: StatusItem[]
} {
  const sections = Object.fromEntries(
    splitByHeading(markdown, 2).map((section) => [section.heading, section.body]),
  )
  const labelRows = parseTableRows(sections['任務標籤'] ?? '')
  const labelData = labelRows[0]?.[0] === '名稱' ? labelRows.slice(1) : labelRows
  const labels: Label[] = labelData
    .filter((row) => row[0] && !isEmptyPlaceholder(row[0]))
    .map((row) => ({
      id: generateId(),
      name: row[0],
      color: row[1] || DEFAULT_LABEL_COLOR,
    }))

  const statusRows = parseTableRows(sections['狀態標籤'] ?? '')
  const statusData = statusRows[0]?.[0] === '名稱' ? statusRows.slice(1) : statusRows
  const statusItems: StatusItem[] = statusData
    .map((row) => {
      const name = row[0]
      const idRaw = (row[1] ?? '').replace(/`/g, '').trim()
      const color = row[2] || ''
      if (!ALL_STATUSES.includes(idRaw as TaskStatus)) return null
      const id = idRaw as TaskStatus
      return {
        id,
        name: name || STATUS_LABELS[id],
        color,
        bgColor: getStatusBgForColor(color),
      }
    })
    .filter((item): item is StatusItem => Boolean(item))

  return { labels, statusItems }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function hydrateTask(task: BackupFileTask, photos: PhotoIndex): Task {
  const attachments = asArray<BackupFileAttachment>(task.attachments)
    .map((item) => hydrateBackupAttachment(item, photos, 'task', task.id))
    .filter((item): item is Attachment => Boolean(item))
  const subtasks = asArray<BackupFileTask['subtasks'][number]>(task.subtasks).map((sub) => ({
    ...sub,
    attachments: asArray<BackupFileAttachment>(sub.attachments)
      .map((item) => hydrateBackupAttachment(item, photos, 'subtask', sub.id))
      .filter((item): item is Attachment => Boolean(item)),
  }))
  const notes = asArray<BackupFileTask['notes'][number]>(task.notes).map((note) => ({
    ...note,
    attachments: asArray<BackupFileAttachment>(note.attachments)
      .map((item) => hydrateBackupAttachment(item, photos, 'note', note.id))
      .filter((item): item is Attachment => Boolean(item)),
  }))
  return {
    ...task,
    attachments,
    subtasks,
    notes,
  }
}

async function parseFromJson(
  entry: JSZip.JSZipObject,
  photos: PhotoIndex,
): Promise<BackupSource> {
  const raw = JSON.parse(await entry.async('string')) as BackupPayload
  if (!isRecord(raw) || !Array.isArray(raw.tasks)) {
    throw new Error('備份資料格式不正確')
  }
  return {
    labels: asArray<Label>(raw.labels),
    statusItems: asArray<StatusItem>(raw.statusItems),
    toolboxLists: asArray<ToolboxList>(raw.toolboxLists),
    tasks: asArray<BackupFileTask>(raw.tasks).map((task) => hydrateTask(task, photos)),
  }
}

async function parseFromMarkdown(
  entries: Map<string, JSZip.JSZipObject>,
  photos: PhotoIndex,
): Promise<BackupSource> {
  const labelsEntry = findEntry(entries, LABELS_FILE)
  const parsedLabels = labelsEntry
    ? parseLabelsMarkdown(await labelsEntry.async('string'))
    : { labels: [], statusItems: [] }
  const labelsByName = new Map(
    parsedLabels.labels.map((label) => [label.name, label]),
  )

  const tasks: Task[] = []
  for (const [, entry] of filesInFolder(entries, TASK_FOLDER, '.md')) {
    const markdown = await entry.async('string')
    tasks.push(
      parseTaskMarkdown(markdown, labelsByName, parsedLabels.statusItems, photos),
    )
  }

  const toolboxLists: ToolboxList[] = []
  for (const [, entry] of filesInFolder(entries, TOOLBOX_FOLDER, '.md')) {
    toolboxLists.push(parseToolboxMarkdown(await entry.async('string')))
  }

  return {
    labels: parsedLabels.labels,
    statusItems: parsedLabels.statusItems,
    toolboxLists,
    tasks,
  }
}

export async function importBackupZip(file: File): Promise<BackupSource> {
  const entries = await readZipEntries(file)
  if (!entries.size) {
    throw new Error('ZIP 是空的，或不是有效的備份檔')
  }
  const photos = await loadPhotos(entries)
  const jsonEntry = findEntry(entries, BACKUP_JSON_FILE)
  if (jsonEntry) {
    return parseFromJson(jsonEntry, photos)
  }
  const source = await parseFromMarkdown(entries, photos)
  if (!source.tasks.length && !source.labels.length && !source.toolboxLists.length) {
    throw new Error('找不到備份內容。請選擇本應用程式匯出的 ZIP。')
  }
  return source
}
