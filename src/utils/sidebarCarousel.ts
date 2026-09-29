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
  selectedAt: null,
}

function isCarouselMode(value: unknown): value is SidebarCarouselMode {
  return value === 'daily' || value === 'interval'
}

function normalizeImageUrl(value: unknown): string | null {
  return typeof value === 'string' &&
    (value.startsWith('data:image/') || value.startsWith('blob:'))
    ? value
    : null
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
  const selectedAtMs =
    typeof incoming.selectedAt === 'string' ? Date.parse(incoming.selectedAt) : Number.NaN
  const hasSelected =
    Boolean(selectedImageId) && images.some((item) => item.id === selectedImageId)

  return {
    enabled: incoming.enabled === true,
    mode: isCarouselMode(incoming.mode) ? incoming.mode : defaultSidebarCarouselState.mode,
    intervalHours: clampCarouselIntervalHours(incoming.intervalHours),
    images,
    selectedImageId: hasSelected ? selectedImageId : null,
    selectedAt: hasSelected && Number.isFinite(selectedAtMs) ? new Date(selectedAtMs).toISOString() : null,
  }
}

function carouselDayNumber(nowMs: number): number {
  const [year, month, day] = formatDate(new Date(nowMs)).split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

function intervalMs(state: SidebarCarouselState): number {
  return clampCarouselIntervalHours(state.intervalHours) * 3_600_000
}

function stepsSinceAnchor(
  state: SidebarCarouselState,
  anchorMs: number,
  nowMs: number,
): number {
  if (nowMs <= anchorMs) return 0
  if (state.mode === 'daily') {
    return Math.max(0, carouselDayNumber(nowMs) - carouselDayNumber(anchorMs))
  }
  return Math.floor((nowMs - anchorMs) / intervalMs(state))
}

function absoluteCarouselIndex(state: SidebarCarouselState, nowMs: number): number {
  const count = state.images.length
  if (state.mode === 'daily') {
    return modulo(carouselDayNumber(nowMs), count)
  }
  return modulo(Math.floor(nowMs / intervalMs(state)), count)
}

function modulo(value: number, count: number): number {
  return ((value % count) + count) % count
}

function selectedImageIndex(state: SidebarCarouselState): number {
  if (!state.selectedImageId) return -1
  return state.images.findIndex((item) => item.id === state.selectedImageId)
}

export function getSidebarCarouselIndex(
  state: SidebarCarouselState,
  nowMs = Date.now(),
): number {
  const count = state.images.length
  if (count === 0) return 0
  const selectedIndex = selectedImageIndex(state)
  if (selectedIndex >= 0 && state.selectedAt) {
    const anchor = Date.parse(state.selectedAt)
    if (Number.isFinite(anchor)) {
      return modulo(selectedIndex + stepsSinceAnchor(state, anchor, nowMs), count)
    }
  }
  return absoluteCarouselIndex(state, nowMs)
}

export function getSidebarCarouselNextSwitchAt(
  state: SidebarCarouselState,
  nowMs = Date.now(),
): number | null {
  if (state.images.length < 2) return null
  if (state.mode === 'daily') {
    const next = new Date(nowMs)
    next.setHours(24, 0, 0, 0)
    return next.getTime()
  }
  const stepMs = intervalMs(state)
  const selectedIndex = selectedImageIndex(state)
  if (selectedIndex >= 0 && state.selectedAt) {
    const anchor = Date.parse(state.selectedAt)
    if (Number.isFinite(anchor)) {
      const steps = stepsSinceAnchor(state, anchor, nowMs)
      return anchor + (steps + 1) * stepMs
    }
  }
  return (Math.floor(nowMs / stepMs) + 1) * stepMs
}

export function getSidebarCarouselCurrentImage(
  state: SidebarCarouselState,
  nowMs = Date.now(),
): SidebarCarouselImage | null {
  if (!state.images.length) return null
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
