<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  clampMinutes,
  defaultPomodoroSnapshot,
  formatCountdown,
  hydratePomodoro,
  minutesToMs,
  pointerAngleToMinutes,
  POMODORO_PRESETS,
  remainingSweepDeg,
  sessionProgress,
  timeUpBody,
  type PomodoroPhase,
  type PomodoroSnapshot,
} from '@/utils/pomodoro'
import {
  readNotificationPermission,
  requestNotificationPermission,
  showTimeUpNotification,
  startPomodoroAlarm,
  stopPomodoroAlarm,
  unlockPomodoroAudio,
  type NotifyPermission,
} from '@/utils/pomodoroAlarm'
import { loadFromStorage, POMODORO_STATE_KEY, saveToStorage } from '@/utils/storage'

interface Tick {
  x1: number
  y1: number
  x2: number
  y2: number
  long: boolean
}

interface DialLabel {
  text: string
  x: number
  y: number
}

function polar(degFromTop: number, radius: number) {
  const rad = ((degFromTop - 90) * Math.PI) / 180
  return {
    x: 100 + Math.cos(rad) * radius,
    y: 100 + Math.sin(rad) * radius,
  }
}

const DIAL_TICKS: Tick[] = Array.from({ length: 60 }, (_, index) => {
  const long = index % 5 === 0
  const outer = polar(index * 6, 96)
  const inner = polar(index * 6, long ? 84 : 90)
  return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, long }
})

const DIAL_LABELS: DialLabel[] = Array.from({ length: 12 }, (_, index) => {
  const minute = index * 5
  const point = polar(minute * 6, 72)
  return { text: String(minute), x: point.x, y: point.y }
})

const router = useRouter()

const open = ref(false)
const dragging = ref(false)
const durationMs = ref(defaultPomodoroSnapshot().durationMs)
const remainingMs = ref(defaultPomodoroSnapshot().remainingMs)
const endsAt = ref<number | null>(null)
const phase = ref<PomodoroPhase>('idle')
const notifyPermission = ref<NotifyPermission>('default')
const ringing = ref(false)

const dialRef = ref<HTMLElement | null>(null)

let alarmTimer: ReturnType<typeof setTimeout> | null = null
let uiTimer: ReturnType<typeof setInterval> | null = null
let titleTimer: ReturnType<typeof setInterval> | null = null
let titleFlashOn = false
let alarmGeneration = 0

const readout = computed(() => formatCountdown(remainingMs.value))
const sweepDeg = computed(() => remainingSweepDeg(remainingMs.value))
const ringOffset = computed(
  () => 100 - sessionProgress(remainingMs.value, durationMs.value) * 100,
)
const dialMinutes = computed(() => {
  if (remainingMs.value <= 0) return 0
  return clampMinutes(remainingMs.value / 60_000)
})
const activePresetId = computed(
  () => POMODORO_PRESETS.find((preset) => minutesToMs(preset.minutes) === durationMs.value)?.id ?? null,
)
const wedgeBackground = computed(() => {
  const deg = sweepDeg.value
  if (deg <= 0) return 'transparent'
  if (deg >= 359.9) return '#2f9e4f'
  return `conic-gradient(from 0deg, #2f9e4f 0deg ${deg}deg, transparent ${deg}deg)`
})
const statusText = computed(() => {
  if (phase.value === 'running') return '計時中，收合後仍會繼續'
  if (phase.value === 'paused') return '已暫停'
  if (phase.value === 'done' && ringing.value) return '時間到，鬧鐘會一直響到你關閉'
  if (phase.value === 'done') return '時間到'
  return '拖曳鐘面，或點右上角橘色鍵開始'
})
const fabLabel = computed(() => {
  if (ringing.value && !open.value) return '番茄鐘時間到，鬧鐘響著'
  if (open.value) return '收合番茄鐘'
  if (phase.value === 'running') return `番茄鐘計時中，剩餘 ${readout.value}`
  if (phase.value === 'paused') return `番茄鐘已暫停，剩餘 ${readout.value}`
  if (phase.value === 'done') return '番茄鐘時間到'
  return '開啟番茄鐘'
})
const orangeLabel = computed(() => {
  if (phase.value === 'running') return '暫停'
  if (phase.value === 'paused') return '繼續'
  if (phase.value === 'done') return '再開始'
  return '開始'
})

function snapshot(): PomodoroSnapshot {
  return {
    durationMs: durationMs.value,
    remainingMs: remainingMs.value,
    endsAt: endsAt.value,
    phase: phase.value,
  }
}

function persist() {
  saveToStorage(POMODORO_STATE_KEY, snapshot())
}

function applySnapshot(next: PomodoroSnapshot) {
  durationMs.value = next.durationMs
  remainingMs.value = next.remainingMs
  endsAt.value = next.endsAt
  phase.value = next.phase
}

function clearAlarmTimer() {
  if (!alarmTimer) return
  clearTimeout(alarmTimer)
  alarmTimer = null
}

function armAlarm() {
  clearAlarmTimer()
  if (phase.value !== 'running' || endsAt.value == null) return
  alarmTimer = setTimeout(() => {
    void finish()
  }, Math.max(0, endsAt.value - Date.now()))
}

function routeTitle() {
  const title = (router.currentRoute.value.meta.title as string) ?? 'Bullet Journal'
  return `${title} · Bullet Journal`
}

function startTitleFlash() {
  if (titleTimer) return
  titleFlashOn = false
  titleTimer = setInterval(() => {
    titleFlashOn = !titleFlashOn
    document.title = titleFlashOn ? '⏰ 時間到了 · Bullet Journal' : routeTitle()
  }, 700)
}

function stopTitleFlash() {
  if (titleTimer) {
    clearInterval(titleTimer)
    titleTimer = null
  }
  titleFlashOn = false
  document.title = routeTitle()
}

function dismissAlarm() {
  alarmGeneration += 1
  ringing.value = false
  stopPomodoroAlarm()
  stopTitleFlash()
}

async function alertTimeUp() {
  const generation = alarmGeneration
  open.value = true
  const started = await startPomodoroAlarm()
  if (generation !== alarmGeneration) {
    stopPomodoroAlarm()
    return
  }
  ringing.value = started
  if (started) startTitleFlash()
  showTimeUpNotification(timeUpBody(durationMs.value))
}

async function finish() {
  if (phase.value !== 'running') return
  phase.value = 'done'
  remainingMs.value = 0
  endsAt.value = null
  clearAlarmTimer()
  persist()
  await alertTimeUp()
}

function syncTick() {
  if (phase.value !== 'running' || endsAt.value == null) return
  const left = endsAt.value - Date.now()
  if (left <= 0) {
    void finish()
    return
  }
  remainingMs.value = left
}

function onVisibility() {
  if (document.visibilityState !== 'visible') return
  syncTick()
  if (phase.value === 'running') armAlarm()
}

async function start() {
  dismissAlarm()
  unlockPomodoroAudio()
  const ms = phase.value === 'done' || remainingMs.value <= 0 ? durationMs.value : remainingMs.value
  remainingMs.value = ms
  endsAt.value = Date.now() + ms
  phase.value = 'running'
  armAlarm()
  persist()
  notifyPermission.value = await requestNotificationPermission()
}

function pause() {
  if (phase.value !== 'running' || endsAt.value == null) return
  const left = Math.max(0, endsAt.value - Date.now())
  clearAlarmTimer()
  if (left <= 0) {
    void finish()
    return
  }
  remainingMs.value = left
  endsAt.value = null
  phase.value = 'paused'
  persist()
}

function onOrangeClick() {
  if (phase.value === 'running') pause()
  else void start()
}

function reset() {
  dismissAlarm()
  clearAlarmTimer()
  endsAt.value = null
  remainingMs.value = durationMs.value
  phase.value = 'idle'
  persist()
}

function setDurationMinutes(minutes: number) {
  dismissAlarm()
  const ms = minutesToMs(minutes)
  durationMs.value = ms
  remainingMs.value = ms
  endsAt.value = null
  phase.value = 'idle'
}

function applyPreset(minutes: number) {
  if (phase.value === 'running') return
  clearAlarmTimer()
  setDurationMinutes(minutes)
  persist()
}

function dialPoint(event: PointerEvent) {
  const dial = dialRef.value
  if (!dial) return null
  const rect = dial.getBoundingClientRect()
  return {
    dx: event.clientX - (rect.left + rect.width / 2),
    dy: event.clientY - (rect.top + rect.height / 2),
    radius: rect.width / 2,
  }
}

function applyPointer(dx: number, dy: number) {
  const minutes = pointerAngleToMinutes(dx, dy)
  if (minutes == null) return
  setDurationMinutes(minutes)
}

function onDialPointerDown(event: PointerEvent) {
  if (phase.value === 'running') return
  const point = dialPoint(event)
  if (!point || Math.hypot(point.dx, point.dy) < point.radius * 0.16) return
  dragging.value = true
  dialRef.value?.setPointerCapture(event.pointerId)
  applyPointer(point.dx, point.dy)
}

function onDialPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  const point = dialPoint(event)
  if (!point || Math.hypot(point.dx, point.dy) < point.radius * 0.16) return
  applyPointer(point.dx, point.dy)
}

function onDialPointerUp(event: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  if (dialRef.value?.hasPointerCapture(event.pointerId)) {
    dialRef.value.releasePointerCapture(event.pointerId)
  }
  persist()
}

function onDialKeydown(event: KeyboardEvent) {
  if (phase.value === 'running') return
  const current = clampMinutes(durationMs.value / 60_000)
  let next = current
  if (event.key === 'ArrowUp' || event.key === 'ArrowRight') next = Math.min(60, current + 1)
  else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') next = Math.max(1, current - 1)
  else return
  event.preventDefault()
  clearAlarmTimer()
  setDurationMinutes(next)
  persist()
}

function onFabClick() {
  unlockPomodoroAudio()
  open.value = !open.value
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) open.value = false
}

onMounted(() => {
  const saved = loadFromStorage<unknown>(POMODORO_STATE_KEY, null)
  if (saved) {
    const hydrated = hydratePomodoro(saved, Date.now())
    applySnapshot(hydrated.snapshot)
    if (hydrated.justFinished) {
      persist()
      void alertTimeUp()
    } else if (hydrated.snapshot.phase === 'running') {
      armAlarm()
    }
  }
  notifyPermission.value = readNotificationPermission()
  uiTimer = setInterval(syncTick, 200)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  dismissAlarm()
  clearAlarmTimer()
  if (uiTimer) clearInterval(uiTimer)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="anchor">
      <button v-if="ringing" type="button" class="silence" @click="dismissAlarm">
        關閉鬧鐘
      </button>
      <button
        type="button"
        class="fab"
        :class="{
          'is-open': open,
          'is-running': phase === 'running',
          'is-paused': phase === 'paused',
          'is-done': phase === 'done',
        }"
        :aria-expanded="open"
        :aria-label="fabLabel"
        @click="onFabClick"
      >
      <svg class="fab-svg" viewBox="0 0 80 80" aria-hidden="true">
        <circle class="fab-disc" cx="40" cy="40" r="30.2" />
        <circle class="ring-track" cx="40" cy="40" r="33.4" />
        <circle
          v-if="ringOffset < 100"
          class="ring-prog"
          cx="40"
          cy="40"
          r="33.4"
          pathLength="100"
          stroke-dasharray="100"
          :stroke-dashoffset="ringOffset"
        />
        <g class="tomato" :class="{ pulse: phase === 'done' }">
          <circle cx="40" cy="28.6" r="6.6" />
          <path class="stem" d="M40 22.6v-3.4" />
          <path class="leaf" d="M40 22.8c-.5-3.2-.2-5.4.2-6.6.3 1.2.6 3.4-.2 6.6z" />
          <path class="leaf side" d="M39.2 23.2c-2.4-1.1-6.2-1.3-8.2.2 2.4.2 5.4 1.2 8.2 2.4z" />
          <path class="leaf pale" d="M40.8 23.2c2.4-1.1 6.2-1.3 8.2.2-2.4.2-5.4 1.2-8.2 2.4z" />
        </g>
        <text class="fab-readout" x="40" y="51.5">{{ readout }}</text>
      </svg>
      </button>
    </div>

    <Transition name="panel-pop" :duration="{ enter: 220, leave: 180 }">
      <aside
        v-if="open"
        class="panel"
        role="dialog"
        aria-label="番茄鐘"
        @pointerdown="unlockPomodoroAudio"
      >
        <div class="clock-case">
          <span class="brand">番茄.</span>
          <button
            type="button"
            class="orange-btn"
            :aria-label="orangeLabel"
            @click="onOrangeClick"
          >
            <span class="orange-glyph" :class="phase === 'running' ? 'is-pause' : 'is-play'" />
          </button>

          <div
            ref="dialRef"
            class="dial"
            :class="{ 'is-locked': phase === 'running', 'is-dragging': dragging }"
            role="slider"
            aria-label="設定分鐘"
            :aria-valuemin="1"
            :aria-valuemax="60"
            :aria-valuenow="dialMinutes"
            :aria-disabled="phase === 'running'"
            tabindex="0"
            @pointerdown="onDialPointerDown"
            @pointermove="onDialPointerMove"
            @pointerup="onDialPointerUp"
            @pointercancel="onDialPointerUp"
            @keydown="onDialKeydown"
          >
            <div class="wedge" :style="{ background: wedgeBackground }" />
            <svg class="marks" viewBox="0 0 200 200" aria-hidden="true">
              <line
                v-for="(tick, index) in DIAL_TICKS"
                :key="index"
                :x1="tick.x1"
                :y1="tick.y1"
                :x2="tick.x2"
                :y2="tick.y2"
                :class="tick.long ? 'tick-long' : 'tick-short'"
              />
              <text
                v-for="label in DIAL_LABELS"
                :key="label.text"
                :x="label.x"
                :y="label.y"
              >
                {{ label.text }}
              </text>
            </svg>
            <p v-if="sweepDeg < 180" class="motto">
              Great things<br />take time.
            </p>
            <div class="knob" />
          </div>
        </div>

        <p class="readout" :class="{ 'is-done': phase === 'done' }">{{ readout }}</p>
        <p class="status" aria-live="polite">{{ statusText }}</p>

        <button v-if="ringing" type="button" class="silence-panel" @click="dismissAlarm">
          關閉鬧鐘
        </button>

        <div class="presets">
          <button
            v-for="preset in POMODORO_PRESETS"
            :key="preset.id"
            type="button"
            class="preset"
            :class="{ 'is-active': activePresetId === preset.id }"
            :disabled="phase === 'running'"
            :aria-pressed="activePresetId === preset.id"
            @click="applyPreset(preset.minutes)"
          >
            {{ preset.label }} {{ preset.minutes }}
          </button>
        </div>

        <button type="button" class="reset" @click="reset">重設</button>

        <p v-if="notifyPermission === 'default'" class="hint">
          開始後會詢問通知權限，時間到可跳出 Windows 提醒
        </p>
        <p v-else-if="notifyPermission === 'denied'" class="hint is-warn">
          通知已被封鎖，時間到仍會響鈴
        </p>
        <p v-else-if="notifyPermission === 'unsupported'" class="hint is-warn">
          這個瀏覽器沒有系統通知，時間到會響鈴
        </p>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.anchor {
  position: fixed;
  z-index: 40;
  right: max(18px, env(safe-area-inset-right));
  bottom: calc(80px + env(safe-area-inset-bottom));
  width: 76px;
  height: 76px;
  overflow: visible;
}

.fab {
  position: relative;
  width: 76px;
  height: 76px;
  padding: 0;
  overflow: visible;
  border-radius: 50%;
  box-shadow: 0 8px 18px rgba(90, 30, 30, 0.16);
}

.silence {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  z-index: 1;
  transform: translateX(-50%);
  padding: 6px 12px;
  border-radius: 999px;
  background: #c2410c;
  color: #fff;
  font-size: 13px;
  font-weight: 750;
  line-height: 1.2;
  white-space: nowrap;
  box-shadow: 0 8px 18px rgba(194, 65, 12, 0.4);
}

.silence-panel {
  display: block;
  width: 100%;
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 999px;
  background: #c2410c;
  color: #fff;
  font-size: 14px;
  font-weight: 750;
  box-shadow: 0 6px 14px rgba(194, 65, 12, 0.28);
}

.fab-svg {
  display: block;
  width: 76px;
  height: 76px;
}

.fab-disc {
  fill: #fffdfb;
}

.ring-track,
.ring-prog {
  fill: none;
  stroke-width: 6.6;
}

.ring-track {
  stroke: #e4e4e4;
}

.ring-prog {
  stroke: #e23b32;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: 40px 40px;
}

.fab.is-paused .ring-prog {
  stroke: #ef8d86;
}

.tomato circle {
  fill: #e23b32;
}

.stem {
  fill: none;
  stroke: #3d8f46;
  stroke-width: 1.35;
  stroke-linecap: round;
}

.leaf {
  fill: #43a047;
}

.leaf.side {
  fill: #2e7d32;
}

.leaf.pale {
  fill: #66bb6a;
}

.tomato.pulse {
  transform-origin: 40px 28px;
  animation: tomato-pulse 1.1s ease-in-out infinite;
}

.fab-readout {
  fill: #e23b32;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.04em;
  text-anchor: middle;
  dominant-baseline: middle;
  font-variant-numeric: tabular-nums;
}

.panel {
  position: fixed;
  z-index: 41;
  right: max(16px, env(safe-area-inset-right));
  bottom: calc(188px + env(safe-area-inset-bottom));
  opacity: 1;
  width: min(304px, calc(100vw - 24px));
  max-height: calc(100dvh - 176px);
  overflow: auto;
  padding: 16px 16px 12px;
  border-radius: 28px;
  background: #f6f3ec;
  color: #243028;
  box-shadow:
    0 18px 50px rgba(40, 30, 10, 0.18),
    0 2px 8px rgba(40, 30, 10, 0.08);
  transform-origin: right bottom;
}

.clock-case {
  position: relative;
  width: max(180px, min(100%, calc(100dvh - 360px)));
  margin-inline: auto;
  aspect-ratio: 1;
  border-radius: 18%;
  background: linear-gradient(180deg, #fcfbf8 0%, #f3efe6 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 14px 28px rgba(70, 52, 24, 0.12);
  container-type: inline-size;
}

.brand {
  position: absolute;
  top: 6.5%;
  left: 8%;
  color: #2f9e4f;
  font-weight: 800;
  font-size: clamp(12px, 5.2cqw, 15px);
  letter-spacing: -0.04em;
  line-height: 1;
}

.orange-btn {
  position: absolute;
  top: 5.5%;
  right: 7%;
  width: 13%;
  height: 7%;
  min-width: 28px;
  min-height: 16px;
  padding: 0;
  border-radius: 999px;
  background: linear-gradient(#ffc15a, #f39a1f);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    0 1px 2px rgba(0, 0, 0, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}

.orange-btn:active {
  transform: translateY(1px);
}

.orange-glyph.is-play {
  width: 0;
  height: 0;
  margin-left: 2px;
  border-style: solid;
  border-width: 4px 0 4px 7px;
  border-color: transparent transparent transparent #fff;
}

.orange-glyph.is-pause {
  width: 8px;
  height: 8px;
  border-left: 2.5px solid #fff;
  border-right: 2.5px solid #fff;
}

.dial {
  position: absolute;
  width: 80%;
  aspect-ratio: 1;
  left: 10%;
  top: 16%;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 42%, #ffffff 0%, #fbfbfb 72%, #f2f2f2 100%);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.04),
    0 1px 2px rgba(0, 0, 0, 0.04);
  touch-action: none;
  user-select: none;
  cursor: grab;
  container-type: inline-size;
}

.dial.is-locked {
  cursor: default;
}

.dial.is-dragging {
  cursor: grabbing;
}

.dial:focus-visible,
.orange-btn:focus-visible,
.preset:focus-visible,
.fab:focus-visible,
.reset:focus-visible,
.silence:focus-visible,
.silence-panel:focus-visible {
  outline: 2px solid #2f9e4f;
  outline-offset: 2px;
}

.wedge {
  position: absolute;
  inset: 15%;
  border-radius: 50%;
  pointer-events: none;
}

.marks {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.tick-long {
  stroke: #b7bcc2;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.tick-short {
  stroke: #d7dbdf;
  stroke-width: 1;
  stroke-linecap: round;
}

.marks text {
  fill: #8e949c;
  font-size: 8px;
  font-weight: 650;
  text-anchor: middle;
  dominant-baseline: central;
}

.motto {
  position: absolute;
  left: 16%;
  top: 61%;
  z-index: 1;
  width: 36%;
  margin: 0;
  text-align: left;
  color: #2c6b45;
  font-size: 4.3cqw;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.02em;
  pointer-events: none;
}

.knob {
  position: absolute;
  z-index: 2;
  left: 50%;
  top: 50%;
  width: 18%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle at 40% 35%, #ffe7b0 0%, #f0c56a 58%, #e3b45a 100%);
  box-shadow:
    -8px 10px 14px rgba(70, 55, 20, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.readout {
  margin: 12px 0 0;
  text-align: center;
  font-size: 28px;
  font-weight: 750;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  color: #1f6b34;
  line-height: 1.1;
}

.readout.is-done {
  color: #c2410c;
}

.status {
  margin: 4px 0 0;
  text-align: center;
  font-size: 12px;
  line-height: 1.5;
  color: #66756c;
}

.presets {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.preset {
  flex: 1;
  min-width: 0;
  padding: 6px 4px;
  border-radius: 999px;
  border: 1px solid #d5e4d6;
  background: #fff;
  color: #246b38;
  font-size: 12px;
  font-weight: 650;
}

.preset.is-active {
  background: #2f9e4f;
  border-color: #2f9e4f;
  color: #fff;
}

.preset:disabled {
  opacity: 0.45;
  cursor: default;
}

.reset {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 4px 0 0;
  color: #7b847e;
  font-size: 12px;
}

.hint {
  margin: 6px 0 0;
  text-align: center;
  font-size: 12px;
  line-height: 1.45;
  color: #66756c;
}

.hint.is-warn {
  color: #b45309;
}

.panel-pop-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(0.34, 1.35, 0.64, 1);
}

.panel-pop-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.panel-pop-enter-from,
.panel-pop-leave-to {
  transform: translateY(8px) scale(0.98);
}

@keyframes tomato-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.07);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tomato.pulse,
  .panel-pop-enter-active,
  .panel-pop-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
