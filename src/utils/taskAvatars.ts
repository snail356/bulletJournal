import type { AppIconName } from '@/plugins/fontawesome'
import type { TaskAvatar } from '@/types'
import { fileToDataUrl } from '@/utils/attachment'

export const TASK_AVATAR_ICON_OPTIONS: AppIconName[] = [
  'briefcase',
  'code',
  'users',
  'bolt',
  'star',
  'bug',
  'lightbulb',
  'comments',
  'flag',
  'rocket',
]

export const DEFAULT_TASK_AVATARS: TaskAvatar[] = [
  { id: 'avatar-work', name: '工作', icon: 'briefcase', imageUrl: null },
  { id: 'avatar-dev', name: '開發', icon: 'code', imageUrl: null },
  { id: 'avatar-meet', name: '會議', icon: 'users', imageUrl: null },
  { id: 'avatar-urgent', name: '緊急', icon: 'bolt', imageUrl: null },
  { id: 'avatar-personal', name: '個人', icon: 'star', imageUrl: null },
]

const DEFAULT_AVATAR_IDS = new Set(DEFAULT_TASK_AVATARS.map((item) => item.id))
const AVATAR_PIXEL_SIZE = 96

function isAvatarIcon(value: unknown): value is AppIconName {
  return (
    typeof value === 'string' &&
    TASK_AVATAR_ICON_OPTIONS.includes(value as AppIconName)
  )
}

function normalizeImageUrl(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('data:image/')
    ? value
    : null
}

export function isDefaultTaskAvatar(id: string): boolean {
  return DEFAULT_AVATAR_IDS.has(id)
}

export function normalizeTaskAvatar(
  item: Partial<TaskAvatar> | undefined,
  fallback: TaskAvatar,
): TaskAvatar {
  return {
    id: typeof item?.id === 'string' && item.id ? item.id : fallback.id,
    name:
      typeof item?.name === 'string' && item.name.trim()
        ? item.name.trim()
        : fallback.name,
    icon: isAvatarIcon(item?.icon) ? item.icon : fallback.icon,
    imageUrl: normalizeImageUrl(item?.imageUrl),
  }
}

export function normalizeTaskAvatars(value: unknown): TaskAvatar[] {
  const incoming = Array.isArray(value) ? value : []
  const byId = new Map<string, Partial<TaskAvatar>>()
  for (const raw of incoming) {
    if (raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string') {
      byId.set(raw.id, raw as Partial<TaskAvatar>)
    }
  }

  const defaults = DEFAULT_TASK_AVATARS.map((fallback) =>
    normalizeTaskAvatar(byId.get(fallback.id), fallback),
  )

  const extras = incoming
    .filter((raw): raw is Partial<TaskAvatar> & { id: string } => {
      return Boolean(
        raw &&
          typeof raw === 'object' &&
          typeof (raw as TaskAvatar).id === 'string' &&
          !DEFAULT_AVATAR_IDS.has((raw as TaskAvatar).id),
      )
    })
    .map((item) =>
      normalizeTaskAvatar(item, {
        id: item.id,
        name: '自訂頭像',
        icon: 'star',
        imageUrl: null,
      }),
    )
    .filter((item) => item.imageUrl || item.name)

  return [...defaults, ...extras]
}

export function findTaskAvatar(
  avatars: TaskAvatar[],
  avatarId: string | null | undefined,
): TaskAvatar | undefined {
  if (!avatarId) return undefined
  return avatars.find((item) => item.id === avatarId)
}

export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('請選擇圖片檔')
  }
  const source = await fileToDataUrl(file)
  return cropSquareDataUrl(source, AVATAR_PIXEL_SIZE)
}

function cropSquareDataUrl(src: string, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('無法處理圖片'))
        return
      }
      const min = Math.min(img.width, img.height) || 1
      const sx = (img.width - min) / 2
      const sy = (img.height - min) / 2
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
      const webp = canvas.toDataURL('image/webp', 0.85)
      resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => reject(new Error('圖片讀取失敗'))
    img.src = src
  })
}
