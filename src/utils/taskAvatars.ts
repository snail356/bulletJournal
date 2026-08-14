import type { AppIconName } from '@/plugins/fontawesome'
import type { TaskAvatar } from '@/types'

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
  { id: 'avatar-work', name: '工作', icon: 'briefcase' },
  { id: 'avatar-dev', name: '開發', icon: 'code' },
  { id: 'avatar-meet', name: '會議', icon: 'users' },
  { id: 'avatar-urgent', name: '緊急', icon: 'bolt' },
  { id: 'avatar-personal', name: '個人', icon: 'star' },
]

function isAvatarIcon(value: unknown): value is AppIconName {
  return (
    typeof value === 'string' &&
    TASK_AVATAR_ICON_OPTIONS.includes(value as AppIconName)
  )
}

export function normalizeTaskAvatars(value: unknown): TaskAvatar[] {
  const incoming = Array.isArray(value) ? value : []
  return DEFAULT_TASK_AVATARS.map((fallback, index) => {
    const item = incoming[index] as Partial<TaskAvatar> | undefined
    return {
      id: fallback.id,
      name:
        typeof item?.name === 'string' && item.name.trim()
          ? item.name.trim()
          : fallback.name,
      icon: isAvatarIcon(item?.icon) ? item.icon : fallback.icon,
    }
  })
}

export function findTaskAvatar(
  avatars: TaskAvatar[],
  avatarId: string | null | undefined,
): TaskAvatar | undefined {
  if (!avatarId) return undefined
  return avatars.find((item) => item.id === avatarId)
}
