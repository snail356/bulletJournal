import type {
  SidebarCarouselImage,
  SidebarCarouselMode,
  SidebarCarouselState,
} from '@/types'
import { fileToDataUrl } from '@/utils/attachment'
import { formatDate } from '@/utils/date'
import { generateId } from '@/utils/id'

export const SIDEBAR_CAROUSEL_MAX_IMAGES = 12
export const SIDEBAR_CAROUSEL_MIN_HOURS = 1
export const SIDEBAR_CAROUSEL_MAX_HOURS = 168
const CAROUSEL_MAX_EDGE = 520

export const defaultSidebarCarouselState: SidebarCarouselState = {
  enabled: false,
  mode: 'daily',
  intervalHours: 6,
  images: [],
  selectedImageId: null,
}

function isCarouselMode(value: unknown): value is SidebarCarouselMode {
  return value === 'daily' || value === 'interval'
}

function normalizeImageUrl(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('data:image/') ? value : null
}

export function clampCarouselIntervalHours(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return defaultSidebarCarouselState.intervalHours
  return Math.min(
    SIDEBAR_CAROUSEL_MAX_HOURS,
    Math.max(SIDEBAR_CAROUSEL_MIN_HOURS, Math.round(n)),
  )
}

function normalizeCarouselImage(raw: unknown): SidebarCarouselImage | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<SidebarCarouselImage>
  const imageUrl = normalizeImageUrl(item.imageUrl)
  if (!imageUrl) return null
  return {
    id: typeof item.id === 'string' && item.id ? item.id : generateId(),
    fileName:
      typeof item.fileName === 'string' && item.fileName.trim()
        ? item.fileName.trim()
        : 'image',
    imageUrl,
    createdAt:
      typeof item.createdAt === 'string' && item.createdAt
        ? item.createdAt
        : new Date().toISOString(),
  }
}

export function normalizeSidebarCarouselState(raw: unknown): SidebarCarouselState {
  const incoming =
    raw && typeof raw === 'object' ? (raw as Partial<SidebarCarouselState>) : {}
  const images = Array.isArray(incoming.images)
    ? incoming.images
        .map(normalizeCarouselImage)
        .filter((item): item is SidebarCarouselImage => Boolean(item))
        .slice(0, SIDEBAR_CAROUSEL_MAX_IMAGES)
    : []

  const selectedImageId =
    typeof incoming.selectedImageId === 'string' && incoming.selectedImageId
      ? incoming.selectedImageId
      : null

  return {
    enabled: incoming.enabled === true,
    mode: isCarouselMode(incoming.mode) ? incoming.mode : defaultSidebarCarouselState.mode,
    intervalHours: clampCarouselIntervalHours(incoming.intervalHours),
    images,
    selectedImageId:
      selectedImageId && images.some((item) => item.id === selectedImageId)
        ? selectedImageId
        : null,
  }
}

export function getSidebarCarouselIndex(
  state: SidebarCarouselState,
  nowMs = Date.now(),
): number {
  const count = state.images.length
  if (count === 0) return 0
  if (state.mode === 'daily') {
    const [year, month, day] = formatDate(new Date(nowMs)).split('-').map(Number)
    const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
    return ((dayNumber % count) + count) % count
  }
  const hours = clampCarouselIntervalHours(state.intervalHours)
  const slot = Math.floor(nowMs / (hours * 3_600_000))
  return ((slot % count) + count) % count
}

export function getSidebarCarouselCurrentImage(
  state: SidebarCarouselState,
  nowMs = Date.now(),
): SidebarCarouselImage | null {
  if (!state.images.length) return null
  if (state.selectedImageId) {
    const selected = state.images.find((item) => item.id === state.selectedImageId)
    if (selected) return selected
  }
  return state.images[getSidebarCarouselIndex(state, nowMs)] ?? state.images[0]
}

export async function fileToCarouselDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('請選擇圖片檔')
  }
  const source = await fileToDataUrl(file)
  return resizeCarouselDataUrl(source)
}

function resizeCarouselDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const longest = Math.max(img.width, img.height) || 1
      const scale = longest > CAROUSEL_MAX_EDGE ? CAROUSEL_MAX_EDGE / longest : 1
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('無法處理圖片'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      const webp = canvas.toDataURL('image/webp', 0.82)
      resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => reject(new Error('圖片讀取失敗'))
    img.src = src
  })
}
