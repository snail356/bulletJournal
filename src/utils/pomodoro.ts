export type PomodoroPhase = 'idle' | 'running' | 'paused' | 'done'

export interface PomodoroSnapshot {
  durationMs: number
  remainingMs: number
  endsAt: number | null
  phase: PomodoroPhase
}

export interface HydratedPomodoro {
  snapshot: PomodoroSnapshot
  /** 離開期間已逾時，且仍在可補響的時間內 */
  justFinished: boolean
}

export const POMODORO_PRESETS = [
  { id: 'focus', label: '專注', minutes: 25 },
  { id: 'short', label: '短休', minutes: 5 },
  { id: 'long', label: '長休', minutes: 15 },
] as const

export const DEFAULT_DURATION_MS = 25 * 60 * 1000
const MIN_DURATION_MS = 60 * 1000
const MAX_DURATION_MS = 60 * 60 * 1000
/** 關閉分頁後回來，超過這段時間就不再補響，只留下時間到的狀態 */
const LATE_ALARM_MS = 10 * 60 * 1000

export function defaultPomodoroSnapshot(): PomodoroSnapshot {
  return {
    durationMs: DEFAULT_DURATION_MS,
    remainingMs: DEFAULT_DURATION_MS,
    endsAt: null,
    phase: 'idle',
  }
}

export function clampMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 25
  return Math.min(60, Math.max(1, Math.round(minutes)))
}

export function minutesToMs(minutes: number): number {
  return clampMinutes(minutes) * 60_000
}

function readMs(value: unknown, fallback: number, min: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(MAX_DURATION_MS, Math.max(min, Math.round(value)))
}

export function sanitizeSnapshot(raw: unknown): PomodoroSnapshot {
  const base = defaultPomodoroSnapshot()
  if (!raw || typeof raw !== 'object') return base
  const record = raw as Partial<PomodoroSnapshot>
  const durationMs = readMs(record.durationMs, base.durationMs, MIN_DURATION_MS)
  let remainingMs = readMs(record.remainingMs, durationMs, 0)
  if (remainingMs > durationMs) remainingMs = durationMs
  const endsAt =
    typeof record.endsAt === 'number' && Number.isFinite(record.endsAt)
      ? record.endsAt
      : null
  let phase: PomodoroPhase =
    record.phase === 'running' ||
    record.phase === 'paused' ||
    record.phase === 'done'
      ? record.phase
      : 'idle'
  if (phase === 'running' && endsAt == null) phase = 'paused'
  if ((phase === 'paused' || phase === 'idle') && remainingMs <= 0) phase = 'done'
  return { durationMs, remainingMs, endsAt, phase }
}

export function hydratePomodoro(raw: unknown, now = Date.now()): HydratedPomodoro {
  const snapshot = sanitizeSnapshot(raw)
  if (snapshot.phase !== 'running' || snapshot.endsAt == null) {
    return { snapshot, justFinished: false }
  }
  const remainingMs = snapshot.endsAt - now
  if (remainingMs > 0) {
    return {
      justFinished: false,
      snapshot: { ...snapshot, remainingMs },
    }
  }
  return {
    justFinished: now - snapshot.endsAt <= LATE_ALARM_MS,
    snapshot: { ...snapshot, phase: 'done', remainingMs: 0, endsAt: null },
  }
}

/** 60 分鐘鐘面上，剩餘時間對應的順時針張角（0 在 12 點） */
export function remainingSweepDeg(remainingMs: number): number {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 0
  const minutes = remainingMs / 60_000
  return Math.min(360, (minutes / 60) * 360)
}

export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00'
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** 這一輪還剩多少，1 是剛開始，0 是結束 */
export function sessionProgress(remainingMs: number, durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 0
  return Math.min(1, remainingMs / durationMs)
}

export function timeUpBody(durationMs: number): string {
  const minutes = clampMinutes(durationMs / 60_000)
  return `${minutes} 分鐘到了`
}

/**
 * 以鐘面中心為原點的位移，換成 1–60 分鐘。
 * 12 點方向是 60，順時針增加；靠太近圓心時無法判斷方向。
 */
export function pointerAngleToMinutes(dx: number, dy: number): number | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null
  if (dx * dx + dy * dy < 1e-6) return null
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI
  const fromTop = (degrees + 90 + 360) % 360
  const minutes = Math.round(fromTop / 6) % 60
  return minutes === 0 ? 60 : minutes
}
