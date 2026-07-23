import JSZip from 'jszip'
import type {
  Attachment,
  DailyReflection,
  Label,
  StatusItem,
  Task,
} from '@/types'
import { todayString } from '@/utils/date'

export interface BackupExportInput {
  tasks: Task[]
  labels: Label[]
  statusItems: StatusItem[]
  reflections: DailyReflection[]
}

export interface BackupExportResult {
  fileName: string
  blob: Blob
  taskCount: number
  reflectionCount: number
  imageCount: number
}

function sanitizeFileName(name: string, fallback = 'untitled'): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+|\.+$/g, '')
  return cleaned.slice(0, 80) || fallback
}

function escapeMd(text: string): string {
  return text.replace(/\r\n/g, '\n')
}

function statusName(statusItems: StatusItem[], statusId: string): string {
  return statusItems.find((item) => item.id === statusId)?.name ?? statusId
}

function labelNames(labels: Label[], ids: string[]): string {
  return ids
    .map((id) => labels.find((label) => label.id === id)?.name ?? id)
    .join('、')
}

function mdImage(relPath: string, alt: string): string {
  return `![${alt}](${relPath})`
}

async function dataUrlToWebpBlob(dataUrl: string): Promise<Blob | null> {
  try {
    const response = await fetch(dataUrl)
    const sourceBlob = await response.blob()
    if (sourceBlob.type === 'image/webp') return sourceBlob

    const bitmap = await createImageBitmap(sourceBlob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return null
    }
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    const webp = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.9)
    })
    return webp
  } catch {
    return null
  }
}

async function exportAttachmentAsWebp(
  attachment: Attachment,
  zip: JSZip,
  usedNames: Set<string>,
): Promise<{ zipPath: string; fileName: string } | null> {
  if (!attachment.url?.startsWith('data:')) return null

  const webpBlob = await dataUrlToWebpBlob(attachment.url)
  if (!webpBlob) return null

  const base = sanitizeFileName(
    attachment.fileName.replace(/\.[^.]+$/, '') || attachment.id,
    attachment.id,
  )
  let fileName = `${base}.webp`
  let n = 1
  while (usedNames.has(fileName)) {
    fileName = `${base}-${n}.webp`
    n += 1
  }
  usedNames.add(fileName)

  const zipPath = `images/${fileName}`
  zip.file(zipPath, webpBlob)
  return { zipPath, fileName }
}

function buildTaskMarkdown(
  task: Task,
  statusItems: StatusItem[],
  labels: Label[],
  imageMap: Map<string, string>,
): string {
  const lines: string[] = []
  lines.push(`# ${task.title || '（無標題）'}`)
  lines.push('')
  lines.push(`- 日期：${task.date}`)
  lines.push(`- 狀態：${statusName(statusItems, task.status)}`)
  lines.push(
    `- 時數：${task.statusHours != null ? `${task.statusHours}h` : '（未填）'}`,
  )
  lines.push(
    `- 標籤：${task.labels.length ? labelNames(labels, task.labels) : '（無）'}`,
  )
  lines.push(`- 完成：${task.completed ? '是' : '否'}`)
  if (task.difficultyNote.trim()) {
    lines.push(`- 困難點：${task.difficultyNote.trim()}`)
  }
  lines.push(`- 任務 ID：\`${task.id}\``)
  lines.push('')

  lines.push('## 內容')
  lines.push('')
  if (task.bodyContent.trim()) {
    lines.push(escapeMd(task.bodyContent.trim()))
  } else {
    lines.push('（空白）')
  }
  lines.push('')

  const taskAtts = task.attachments.filter((att) => imageMap.has(att.id))
  if (taskAtts.length) {
    lines.push('## 附件')
    lines.push('')
    for (const att of taskAtts) {
      const path = imageMap.get(att.id)!
      lines.push(mdImage(`../../${path}`, att.fileName || 'image'))
      lines.push('')
    }
  }

  if (task.subtasks.length) {
    lines.push('## 子任務')
    lines.push('')
    for (const sub of task.subtasks) {
      const mark = sub.completed ? 'x' : ' '
      lines.push(`### [${mark}] ${sub.title || '（無標題）'}`)
      lines.push('')
      if (sub.note.trim()) {
        lines.push(escapeMd(sub.note.trim()))
        lines.push('')
      }
      for (const att of sub.attachments) {
        const path = imageMap.get(att.id)
        if (!path) continue
        lines.push(mdImage(`../../${path}`, att.fileName || 'image'))
        lines.push('')
      }
    }
  }

  if (task.notes.length) {
    lines.push('## 備註 / 進度')
    lines.push('')
    for (const [i, note] of task.notes.entries()) {
      lines.push(`### 備註 ${i + 1}`)
      lines.push('')
      if (note.content.trim()) {
        lines.push(escapeMd(note.content.trim()))
        lines.push('')
      }
      for (const att of note.attachments) {
        const path = imageMap.get(att.id)
        if (!path) continue
        lines.push(mdImage(`../../${path}`, att.fileName || 'image'))
        lines.push('')
      }
    }
  }

  if (task.migrationHistory.length) {
    lines.push('## 遷移紀錄')
    lines.push('')
    for (const record of task.migrationHistory) {
      lines.push(
        `- ${record.fromDate} → ${record.toDate}（${record.migratedAt}）`,
      )
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd() + '\n'
}

function buildReflectionMarkdown(reflection: DailyReflection): string {
  const lines: string[] = []
  lines.push(`# 每日回顧 ${reflection.date}`)
  lines.push('')
  lines.push(
    `- 狀態：${reflection.status === 'submitted' ? '已提交' : '草稿'}`,
  )
  lines.push('')
  lines.push('## 早上')
  lines.push('')
  lines.push(escapeMd(reflection.morningContent.trim() || '（未填寫）'))
  lines.push('')
  lines.push('## 下午1點-3點')
  lines.push('')
  lines.push(escapeMd(reflection.afternoon1to3Content.trim() || '（未填寫）'))
  lines.push('')
  lines.push('## 下午3點後')
  lines.push('')
  lines.push(escapeMd(reflection.afternoonAfter3Content.trim() || '（未填寫）'))
  lines.push('')
  lines.push('## 當日總結')
  lines.push('')
  lines.push(escapeMd(reflection.summaryContent.trim() || '（未填寫）'))
  lines.push('')
  if (reflection.aiManagerAdvice.trim()) {
    lines.push('## AI 主管建議')
    lines.push('')
    lines.push(escapeMd(reflection.aiManagerAdvice.trim()))
    lines.push('')
    if (reflection.aiGeneratedAt) {
      lines.push(`_產生於 ${reflection.aiGeneratedAt}_`)
      lines.push('')
    }
  }
  return lines.join('\n').trimEnd() + '\n'
}

function buildIndexMarkdown(
  input: BackupExportInput,
  imageCount: number,
  exportedAt: string,
): string {
  const lines: string[] = []
  lines.push('# Bullet Journal 備份')
  lines.push('')
  lines.push(`- 匯出時間：${exportedAt}`)
  lines.push(`- 任務數：${input.tasks.length}`)
  lines.push(`- 回顧日誌數：${input.reflections.length}`)
  lines.push(`- 圖片數（WebP）：${imageCount}`)
  lines.push(`- 標籤數：${input.labels.length}`)
  lines.push('')
  lines.push('## 目錄結構')
  lines.push('')
  lines.push('```')
  lines.push('README.md')
  lines.push('tasks/{日期}/{任務}.md')
  lines.push('reflections/{日期}.md')
  lines.push('images/*.webp')
  lines.push('```')
  lines.push('')
  lines.push('Markdown 內的圖片以相對路徑引用 `images/` 下的 WebP 檔。')
  lines.push('')
  return lines.join('\n')
}

function collectAttachments(tasks: Task[]): Attachment[] {
  const list: Attachment[] = []
  for (const task of tasks) {
    list.push(...task.attachments)
    for (const sub of task.subtasks) list.push(...sub.attachments)
    for (const note of task.notes) list.push(...note.attachments)
  }
  return list
}

export async function buildBackupZip(
  input: BackupExportInput,
): Promise<BackupExportResult> {
  const zip = new JSZip()
  const usedImageNames = new Set<string>()
  const imageMap = new Map<string, string>()

  const attachments = collectAttachments(input.tasks)
  for (const attachment of attachments) {
    const exported = await exportAttachmentAsWebp(
      attachment,
      zip,
      usedImageNames,
    )
    if (exported) imageMap.set(attachment.id, exported.zipPath)
  }

  const tasksByDate = [...input.tasks].sort((a, b) =>
    a.date === b.date
      ? a.title.localeCompare(b.title, 'zh-Hant')
      : a.date.localeCompare(b.date),
  )

  const usedTaskNames = new Map<string, Set<string>>()
  for (const task of tasksByDate) {
    const dateSet = usedTaskNames.get(task.date) ?? new Set<string>()
    usedTaskNames.set(task.date, dateSet)

    let base = sanitizeFileName(task.title, task.id)
    let fileName = `${base}.md`
    let n = 1
    while (dateSet.has(fileName)) {
      fileName = `${base}-${n}.md`
      n += 1
    }
    dateSet.add(fileName)

    const markdown = buildTaskMarkdown(
      task,
      input.statusItems,
      input.labels,
      imageMap,
    )
    zip.file(`tasks/${task.date}/${fileName}`, markdown)
  }

  const reflections = [...input.reflections].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  for (const reflection of reflections) {
    zip.file(
      `reflections/${reflection.date}.md`,
      buildReflectionMarkdown(reflection),
    )
  }

  const exportedAt = new Date().toISOString()
  zip.file(
    'README.md',
    buildIndexMarkdown(input, imageMap.size, exportedAt),
  )

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const stamp = todayString().replace(/-/g, '')
  return {
    fileName: `bullet-journal-backup-${stamp}.zip`,
    blob,
    taskCount: input.tasks.length,
    reflectionCount: input.reflections.length,
    imageCount: imageMap.size,
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
