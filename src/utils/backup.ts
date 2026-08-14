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
  ToolboxList,
} from '@/types'
import { STATUS_LABELS } from '@/utils/status'

export const BACKUP_JSON_FILE = 'data.json'
export const BACKUP_FORMAT = 'bullet-journal-md-webp'
export const BACKUP_VERSION = 1

export interface BackupSource {
  tasks: Task[]
  labels: Label[]
  statusItems: StatusItem[]
  toolboxLists: ToolboxList[]
}

export interface BackupFileAttachment {
  id: string
  ownerType: AttachmentOwnerType
  ownerId: string
  fileName: string
  mimeType: string
  file: string
  createdAt: string
}

export interface BackupFileTask extends Omit<Task, 'attachments' | 'subtasks' | 'notes'> {
  attachments: BackupFileAttachment[]
  subtasks: Array<Omit<SubTask, 'attachments'> & { attachments: BackupFileAttachment[] }>
  notes: Array<Omit<Note, 'attachments'> & { attachments: BackupFileAttachment[] }>
}

export interface BackupPayload {
  version: number
  format: string
  exportedAt: string
  labels: Label[]
  statusItems: StatusItem[]
  toolboxLists: ToolboxList[]
  tasks: BackupFileTask[]
}

export interface BackupResult {
  fileName: string
  taskCount: number
  labelCount: number
  toolboxCount: number
  photoCount: number
}

const NOTE_COLOR_LABEL: Record<Note['color'], string> = {
  purple: '紫',
  orange: '橙',
  green: '綠',
  blue: '藍',
  gray: '灰',
}

interface PhotoFile {
  zipPath: string
  blob: Blob
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function backupStamp(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('zh-TW')
}

function sanitizeFileName(name: string, fallback = 'untitled'): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 80)
  return cleaned || fallback
}

function createUniqueName(): (base: string, ext: string) => string {
  const used = new Set<string>()
  return (base: string, ext: string) => {
    let name = `${base}${ext}`
    let i = 2
    while (used.has(name.toLowerCase())) {
      name = `${base}-${i}${ext}`
      i += 1
    }
    used.add(name.toLowerCase())
    return name
  }
}

function mdLink(label: string, path: string): string {
  return `[${label.replace(/[[\]]/g, '')}](<${path}>)`
}

function mdImage(alt: string, path: string): string {
  return `![${alt.replace(/[[\]]/g, '')}](<${path}>)`
}

function renderBody(content: string, type: ContentFormat): string {
  const trimmed = content.trim()
  if (!trimmed) return ''
  if (type === 'code') return `\`\`\`\n${trimmed}\n\`\`\``
  return trimmed
}

function joinSections(parts: Array<string | false | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join('\n\n')
    .trim() + '\n'
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy.buffer], { type })
}

function collectTaskAttachments(task: Task): Attachment[] {
  return [
    ...task.attachments,
    ...task.subtasks.flatMap((sub) => sub.attachments),
    ...task.notes.flatMap((note) => note.attachments),
  ]
}

function extensionForMime(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg'
  if (mime.includes('png')) return '.png'
  if (mime.includes('gif')) return '.gif'
  if (mime.includes('svg')) return '.svg'
  if (mime.includes('webp')) return '.webp'
  return '.bin'
}

function decodeBase64DataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/)
  if (!match) return null
  try {
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return { mime: match[1], bytes }
  } catch {
    return null
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('無法載入圖片'))
    img.src = src
  })
}

function canvasToWebp(img: HTMLImageElement, quality = 0.85): Promise<Blob> {
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (!width || !height) {
    return Promise.reject(new Error('圖片尺寸無效'))
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('無法建立畫布'))
  ctx.drawImage(img, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('無法轉成 WebP'))),
      'image/webp',
      quality,
    )
  })
}

async function convertAttachmentToPhoto(
  attachment: Attachment,
): Promise<PhotoFile | null> {
  if (!attachment.url) return null

  const decoded = decodeBase64DataUrl(attachment.url)
  if (decoded?.mime === 'image/webp') {
    return {
      zipPath: `photos/${attachment.id}.webp`,
      blob: bytesToBlob(decoded.bytes, 'image/webp'),
    }
  }

  try {
    const img = await loadImage(attachment.url)
    const blob = await canvasToWebp(img)
    return {
      zipPath: `photos/${attachment.id}.webp`,
      blob,
    }
  } catch {
    if (!decoded) return null
    const ext = extensionForMime(decoded.mime)
    return {
      zipPath: `photos/${attachment.id}${ext}`,
      blob: bytesToBlob(decoded.bytes, decoded.mime),
    }
  }
}

function photoMarkdown(attachments: Attachment[], photos: Map<string, string>, prefix: string): string {
  const lines = attachments
    .map((att) => {
      const path = photos.get(att.id)
      if (!path) return ''
      return mdImage(att.fileName || '照片', `${prefix}${path}`)
    })
    .filter(Boolean)
  return lines.join('\n\n')
}

function renderSubTask(
  sub: SubTask,
  photos: Map<string, string>,
): string {
  const check = sub.completed ? 'x' : ' '
  const lines = [`- [${check}] ${sub.title.trim() || '未命名子任務'}`]
  const note = renderBody(sub.note, sub.noteContentType)
  if (note) {
    lines.push('')
    for (const line of note.split('\n')) {
      lines.push(`  ${line}`)
    }
  }
  const images = photoMarkdown(sub.attachments, photos, '../')
  if (images) {
    lines.push('')
    for (const line of images.split('\n')) {
      lines.push(line ? `  ${line}` : '')
    }
  }
  return lines.join('\n')
}

function buildTaskMarkdown(
  task: Task,
  labelsById: Map<string, Label>,
  statusItems: StatusItem[],
  photos: Map<string, string>,
): string {
  const statusName =
    statusItems.find((item) => item.id === task.status)?.name ??
    STATUS_LABELS[task.status] ??
    task.status
  const labelNames = task.labels
    .map((id) => labelsById.get(id)?.name)
    .filter((name): name is string => Boolean(name))
  const hours =
    task.statusHours === null || task.statusHours === undefined
      ? '—'
      : String(task.statusHours)

  const meta = [
    `| 欄位 | 內容 |`,
    `| --- | --- |`,
    `| 開始日期 | ${escapeTableCell(task.date)} |`,
    `| 結束日期 | ${escapeTableCell(task.endDate ?? '—')} |`,
    `| 日期 | ${escapeTableCell(task.date)} |`,
    `| 狀態 | ${escapeTableCell(statusName)} |`,
    `| 完成 | ${task.completed ? '是' : '否'} |`,
    `| 狀態時數 | ${escapeTableCell(hours)} |`,
    `| 標籤 | ${escapeTableCell(labelNames.join('、') || '—')} |`,
    `| 困難點 | ${escapeTableCell(task.difficultyNote.trim() || '—')} |`,
    `| 建立時間 | ${escapeTableCell(formatDateTime(task.createdAt))} |`,
    `| 更新時間 | ${escapeTableCell(formatDateTime(task.updatedAt))} |`,
  ].join('\n')

  const body = renderBody(task.bodyContent, task.bodyContentType)
  const taskPhotos = photoMarkdown(task.attachments, photos, '../')
  const subtasks = task.subtasks.map((sub) => renderSubTask(sub, photos)).join('\n\n')
  const notes = task.notes
    .map((note, index) => {
      const color = NOTE_COLOR_LABEL[note.color] ?? note.color
      const content = renderBody(note.content, note.contentType)
      const images = photoMarkdown(note.attachments, photos, '../')
      return joinSections([
        `### 備註 ${index + 1}（${color}）`,
        content || '_（無內容）_',
        images,
      ])
    })
    .join('\n')
  const migrations = task.migrationHistory
    .map(
      (record) =>
        `- \`${record.fromDate}\` → \`${record.toDate}\`（${formatDateTime(record.migratedAt)}）`,
    )
    .join('\n')

  return joinSections([
    `# ${task.title.trim() || '未命名任務'}`,
    meta,
    body ? `## 內容\n\n${body}` : '',
    taskPhotos ? `## 照片\n\n${taskPhotos}` : '',
    subtasks ? `## 子任務\n\n${subtasks}` : '',
    notes ? `## 備註\n\n${notes}` : '',
    migrations ? `## 遷移紀錄\n\n${migrations}` : '',
  ])
}

function buildLabelsMarkdown(labels: Label[], statusItems: StatusItem[]): string {
  const labelRows = labels.length
    ? [
        '| 名稱 | 顏色 |',
        '| --- | --- |',
        ...labels.map((label) => `| ${escapeTableCell(label.name)} | ${label.color} |`),
      ].join('\n')
    : '_尚無任務標籤_'

  const statusRows = statusItems.length
    ? [
        '| 名稱 | 代碼 | 顏色 |',
        '| --- | --- | --- |',
        ...statusItems.map(
          (item) => `| ${escapeTableCell(item.name)} | \`${item.id}\` | ${item.color} |`,
        ),
      ].join('\n')
    : '_尚無狀態標籤_'

  return joinSections([
    '# 標籤',
    '## 任務標籤',
    labelRows,
    '## 狀態標籤',
    statusRows,
  ])
}

function buildToolboxMarkdown(list: ToolboxList): string {
  const purpose = list.purpose.trim()
  const items = list.items
    .map((item, index) => {
      const body = renderBody(item.content, item.contentType)
      return joinSections([
        `### ${index + 1}`,
        body || '_（無內容）_',
      ])
    })
    .join('\n')

  return joinSections([
    `# ${list.title.trim() || '未命名清單'}`,
    [
      `| 欄位 | 內容 |`,
      `| --- | --- |`,
      `| 建立時間 | ${escapeTableCell(formatDateTime(list.createdAt))} |`,
      `| 更新時間 | ${escapeTableCell(formatDateTime(list.updatedAt))} |`,
    ].join('\n'),
    purpose ? `## 何時使用\n\n${purpose}` : '',
    items ? `## 思考點\n\n${items}` : '## 思考點\n\n_尚無思考點_',
  ])
}

function buildReadme(params: {
  exportedAt: string
  taskCount: number
  labelCount: number
  statusCount: number
  toolboxCount: number
  photoCount: number
  taskEntries: Array<{ date: string; title: string; path: string }>
  toolboxEntries: Array<{ title: string; path: string }>
}): string {
  const tasksByDate = new Map<string, Array<{ title: string; path: string }>>()
  for (const entry of params.taskEntries) {
    const list = tasksByDate.get(entry.date) ?? []
    list.push(entry)
    tasksByDate.set(entry.date, list)
  }
  const dates = [...tasksByDate.keys()].sort((a, b) => b.localeCompare(a))
  const taskToc = dates.length
    ? dates
        .map((date) => {
          const links = (tasksByDate.get(date) ?? [])
            .map((item) => `- ${mdLink(item.title, item.path)}`)
            .join('\n')
          return `### ${date}\n\n${links}`
        })
        .join('\n\n')
    : '_尚無任務_'

  const toolboxToc = params.toolboxEntries.length
    ? params.toolboxEntries
        .map((item) => `- ${mdLink(item.title, item.path)}`)
        .join('\n')
    : '_尚無清單_'

  return joinSections([
    '# Bullet Journal 備份',
    '此備份以 Markdown 撰寫，照片另存為 WebP（若轉換失敗則保留原格式）並放在 `photos/`。請用設定頁「匯入備份」還原；已存在的任務、標籤與清單會跳過、不會重複新增。',
    [
      `| 項目 | 數量 |`,
      `| --- | --- |`,
      `| 匯出時間 | ${params.exportedAt} |`,
      `| 任務 | ${params.taskCount} |`,
      `| 任務標籤 | ${params.labelCount} |`,
      `| 狀態標籤 | ${params.statusCount} |`,
      `| 工具箱與思考清單 | ${params.toolboxCount} |`,
      `| 照片 | ${params.photoCount} |`,
    ].join('\n'),
    '## 檔案',
    [
      `- ${mdLink('標籤', '標籤.md')}`,
      `- ${mdLink('還原用資料 data.json', BACKUP_JSON_FILE)}`,
      `- 任務/`,
      `- 工具箱與思考清單/`,
      `- photos/`,
    ].join('\n'),
    '## 任務目錄',
    taskToc,
    '## 工具箱與思考清單目錄',
    toolboxToc,
  ])
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function serializeAttachment(
  attachment: Attachment,
  photos: Map<string, string>,
): BackupFileAttachment {
  const file = photos.get(attachment.id) ?? ''
  return {
    id: attachment.id,
    ownerType: attachment.ownerType,
    ownerId: attachment.ownerId,
    fileName: attachment.fileName,
    mimeType: file.endsWith('.webp') ? 'image/webp' : attachment.mimeType,
    file,
    createdAt: attachment.createdAt,
  }
}

function buildBackupPayload(
  source: BackupSource,
  photos: Map<string, string>,
  exportedAt: Date,
): BackupPayload {
  return {
    version: BACKUP_VERSION,
    format: BACKUP_FORMAT,
    exportedAt: exportedAt.toISOString(),
    labels: source.labels,
    statusItems: source.statusItems,
    toolboxLists: source.toolboxLists,
    tasks: source.tasks.map((task) => ({
      ...task,
      attachments: task.attachments.map((item) => serializeAttachment(item, photos)),
      subtasks: task.subtasks.map((sub) => ({
        ...sub,
        attachments: sub.attachments.map((item) => serializeAttachment(item, photos)),
      })),
      notes: task.notes.map((note) => ({
        ...note,
        attachments: note.attachments.map((item) => serializeAttachment(item, photos)),
      })),
    })),
  }
}

export async function downloadBackupZip(source: BackupSource): Promise<BackupResult> {
  const exportedAt = new Date()
  const labelsById = new Map(source.labels.map((label) => [label.id, label]))
  const uniqueTaskName = createUniqueName()
  const uniqueToolboxName = createUniqueName()

  const attachments = source.tasks.flatMap(collectTaskAttachments)
  const photos = new Map<string, string>()
  const photoFiles: PhotoFile[] = []

  for (const attachment of attachments) {
    if (photos.has(attachment.id)) continue
    const photo = await convertAttachmentToPhoto(attachment)
    if (!photo) continue
    photos.set(attachment.id, photo.zipPath)
    photoFiles.push(photo)
  }

  const sortedTasks = [...source.tasks].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date)
    if (byDate !== 0) return byDate
    return b.updatedAt.localeCompare(a.updatedAt)
  })

  const taskEntries: Array<{ date: string; title: string; path: string }> = []
  const zip = new JSZip()

  for (const task of sortedTasks) {
    const title = task.title.trim() || '未命名任務'
    const fileName = uniqueTaskName(
      sanitizeFileName(`${task.date}-${title}`, `${task.date}-task`),
      '.md',
    )
    const path = `任務/${fileName}`
    zip.file(path, buildTaskMarkdown(task, labelsById, source.statusItems, photos))
    taskEntries.push({ date: task.date, title, path })
  }

  const sortedLists = [...source.toolboxLists].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )
  const toolboxEntries: Array<{ title: string; path: string }> = []

  for (const list of sortedLists) {
    const title = list.title.trim() || '未命名清單'
    const fileName = uniqueToolboxName(sanitizeFileName(title, 'list'), '.md')
    const path = `工具箱與思考清單/${fileName}`
    zip.file(path, buildToolboxMarkdown(list))
    toolboxEntries.push({ title, path })
  }

  zip.file('標籤.md', buildLabelsMarkdown(source.labels, source.statusItems))
  zip.file(
    BACKUP_JSON_FILE,
    JSON.stringify(buildBackupPayload(source, photos, exportedAt), null, 2),
  )
  zip.file(
    'README.md',
    buildReadme({
      exportedAt: formatDateTime(exportedAt.toISOString()),
      taskCount: source.tasks.length,
      labelCount: source.labels.length,
      statusCount: source.statusItems.length,
      toolboxCount: source.toolboxLists.length,
      photoCount: photoFiles.length,
      taskEntries,
      toolboxEntries,
    }),
  )

  for (const photo of photoFiles) {
    zip.file(photo.zipPath, photo.blob)
  }

  const fileName = `bullet-journal-backup-${backupStamp(exportedAt)}.zip`
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  triggerDownload(blob, fileName)

  return {
    fileName,
    taskCount: source.tasks.length,
    labelCount: source.labels.length,
    toolboxCount: source.toolboxLists.length,
    photoCount: photoFiles.length,
  }
}
