<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, useId } from 'vue'

const SIZE = 36
const GRID = 8
const MARGIN = 24
const SHADOW_ROOM = 14

const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
const glowId = `led-glow-${uid}`

const pixels = buildLedDots(GRID)

const rootRef = ref<HTMLElement | null>(null)
const x = ref(typeof window !== 'undefined' ? Math.max(8, window.innerWidth - SIZE - MARGIN) : 0)
const y = ref(typeof window !== 'undefined' ? Math.max(8, window.innerHeight - SIZE - MARGIN) : 0)
const ready = ref(false)
const dragging = ref(false)

let hasDragged = false
let startPointerX = 0
let startPointerY = 0
let startX = 0
let startY = 0
let pointerId: number | null = null

function mixLedColor(t: number, light: number): string {
  const palette = [
    [196, 181, 253],
    [125, 211, 252],
    [34, 211, 238],
    [103, 232, 249],
    [165, 243, 252],
    [236, 254, 255],
  ]
  const u = Math.min(0.999, Math.max(0, t * 0.45 + light * 0.55))
  const scaled = u * (palette.length - 1)
  const i = Math.floor(scaled)
  const f = scaled - i
  const a = palette[i]
  const b = palette[i + 1] ?? a
  const r = Math.round(a[0] + (b[0] - a[0]) * f)
  const g = Math.round(a[1] + (b[1] - a[1]) * f)
  const bl = Math.round(a[2] + (b[2] - a[2]) * f)
  return `rgb(${r}, ${g}, ${bl})`
}

function hash01(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return n - Math.floor(n)
}

function buildLedDots(grid: number) {
  const cells: {
    x: number
    y: number
    r: number
    fillDim: string
    fillLit: string
    opDim: number
    opLit: number
    delay: number
  }[] = []
  const cx = (grid - 1) / 2
  const radius = grid / 2 - 0.05
  for (let py = 0; py < grid; py++) {
    for (let px = 0; px < grid; px++) {
      const h = hash01(px, py)
      const dx = px - cx
      const dy = py - cx
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > radius + 0.55) continue
      if (dist > radius * 0.72 && h > 0.7) continue
      if (dist > radius * 0.88 && h > 0.45) continue
      const nx = px / (grid - 1)
      const ny = py / (grid - 1)
      const light = nx * 0.42 + (1 - ny) * 0.28 + Math.max(0, 1 - dist / radius) * 0.4
      const falloff = Math.max(0, 1 - dist / (radius + 0.35))
      const baseOp = (0.34 + light * 0.52) * (0.38 + falloff * 0.62)
      cells.push({
        x: px + (h - 0.5) * 0.28,
        y: py + (hash01(py, px) - 0.5) * 0.28,
        r: 0.24 + light * 0.1,
        fillDim: mixLedColor(nx, light * 0.42),
        fillLit: mixLedColor(nx, Math.min(1, light * 0.9 + 0.35)),
        opDim: baseOp * 0.55,
        opLit: Math.min(1, baseOp * 1.15),
        delay: dist * 0.32 + h * 0.12,
      })
    }
  }
  return cells
}

function size(): number {
  const w = rootRef.value?.offsetWidth ?? 0
  return w > 0 ? w : SIZE
}

function clamp(px: number, py: number) {
  const s = size()
  const maxX = Math.max(8, window.innerWidth - s - 8)
  const maxY = Math.max(8, window.innerHeight - s - SHADOW_ROOM)
  return {
    x: Math.min(Math.max(8, px), maxX),
    y: Math.min(Math.max(8, py), maxY),
  }
}

function placeAtBottomRight() {
  const s = size()
  const next = clamp(
    window.innerWidth - s - MARGIN,
    window.innerHeight - s - MARGIN,
  )
  x.value = next.x
  y.value = next.y
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== undefined && e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  dragging.value = true
  pointerId = e.pointerId
  startPointerX = e.clientX
  startPointerY = e.clientY
  startX = x.value
  startY = y.value
  rootRef.value?.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== pointerId) return
  hasDragged = true
  const next = clamp(
    startX + (e.clientX - startPointerX),
    startY + (e.clientY - startPointerY),
  )
  x.value = next.x
  y.value = next.y
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  dragging.value = false
  pointerId = null
}

function onResize() {
  if (hasDragged) {
    const next = clamp(x.value, y.value)
    x.value = next.x
    y.value = next.y
    return
  }
  placeAtBottomRight()
}

onMounted(async () => {
  await nextTick()
  placeAtBottomRight()
  ready.value = true
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="rootRef"
      class="floating-sphere"
      :class="{ 'is-dragging': dragging, 'is-ready': ready }"
      :style="{ left: `${x}px`, top: `${y}px` }"
      role="img"
      aria-label="可拖動的懸浮球"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <span class="orb-glow" />
      <svg class="orb" :viewBox="`0 0 ${GRID} ${GRID}`" aria-hidden="true">
        <defs>
          <radialGradient :id="`${glowId}-wash`" cx="52%" cy="40%" r="62%">
            <stop class="wash-in" offset="0%" />
            <stop class="wash-out" offset="100%" />
          </radialGradient>
          <filter
            :id="glowId"
            x="-80%"
            y="-80%"
            width="260%"
            height="260%"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.32" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.2 0"
              result="bloom"
            />
            <feMerge>
              <feMergeNode in="bloom" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          class="orb-core"
          :cx="GRID / 2"
          :cy="GRID / 2"
          :r="GRID * 0.42"
          :fill="`url(#${glowId}-wash)`"
        />
        <g :filter="`url(#${glowId})`">
          <g v-for="p in pixels" :key="`${p.x}-${p.y}`">
            <circle
              class="led-dot"
              :cx="p.x + 0.5"
              :cy="p.y + 0.5"
              :r="p.r"
              :style="{
                '--c-dim': p.fillDim,
                '--c-lit': p.fillLit,
                '--op-dim': p.opDim,
                '--op-lit': p.opLit,
                '--delay': `${p.delay}s`,
              }"
            />
            <circle
              class="led-spec"
              :cx="p.x + 0.42"
              :cy="p.y + 0.42"
              :r="p.r * 0.32"
              :style="{ '--delay': `${p.delay}s`, '--op-lit': p.opLit }"
            />
          </g>
        </g>
      </svg>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.floating-sphere {
  position: fixed;
  width: 36px;
  height: 36px;
  z-index: 36;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;

  &.is-ready {
    opacity: 1;
    pointer-events: auto;
  }

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -10px;
    width: 26px;
    height: 8px;
    border-radius: 50%;
    background: radial-gradient(
      ellipse,
      rgba(34, 211, 238, 0.16) 0%,
      rgba(125, 211, 252, 0.06) 48%,
      transparent 72%
    );
    transform: translateX(-50%);
    pointer-events: none;
    filter: blur(1.5px);
    animation: shadow-breathe 3.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
  }

  &.is-dragging {
    cursor: grabbing;
    z-index: 45;

    &::after {
      animation: none;
      width: 30px;
      height: 9px;
      bottom: -12px;
      opacity: 0.5;
    }
  }
}

.orb-glow,
.orb {
  position: absolute;
  inset: 0;
  display: block;
  pointer-events: none;
}

.orb-glow {
  inset: -8px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 58% 40%,
    rgba(165, 243, 252, 0.36) 0%,
    rgba(103, 232, 249, 0.18) 36%,
    rgba(196, 181, 253, 0.1) 58%,
    transparent 74%
  );
  filter: blur(6px);
  animation: glow-breathe 3.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}

.orb {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.wash-in {
  stop-color: #c4b5fd;
  stop-opacity: 0.08;
  animation: wash-in 3.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}

.wash-out {
  stop-color: #67e8f9;
  stop-opacity: 0;
  animation: wash-out 3.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}

.led-dot {
  fill: var(--c-dim);
  opacity: var(--op-dim);
  animation: led-tint 3.4s cubic-bezier(0.45, 0, 0.55, 1) var(--delay, 0s) infinite;
}

.led-spec {
  fill: #ffffff;
  opacity: 0.2;
  animation: led-spec 3.4s cubic-bezier(0.45, 0, 0.55, 1) var(--delay, 0s) infinite;
}

@keyframes led-tint {
  0%,
  100% {
    fill: var(--c-dim);
    opacity: var(--op-dim);
  }
  50% {
    fill: var(--c-lit);
    opacity: var(--op-lit);
  }
}

@keyframes led-spec {
  0%,
  100% {
    opacity: 0.18;
  }
  50% {
    opacity: calc(var(--op-lit) * 0.85);
  }
}

@keyframes wash-in {
  0%,
  100% {
    stop-color: #c4b5fd;
    stop-opacity: 0.07;
  }
  50% {
    stop-color: #ecfeff;
    stop-opacity: 0.26;
  }
}

@keyframes wash-out {
  0%,
  100% {
    stop-color: #a5f3fc;
    stop-opacity: 0;
  }
  50% {
    stop-color: #67e8f9;
    stop-opacity: 0.04;
  }
}

@keyframes glow-breathe {
  0%,
  100% {
    opacity: 0.52;
    filter: blur(6px) hue-rotate(8deg);
  }
  50% {
    opacity: 1;
    filter: blur(6px) hue-rotate(-12deg);
  }
}

@keyframes shadow-breathe {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .floating-sphere::after,
  .orb-glow,
  .wash-in,
  .wash-out,
  .led-dot,
  .led-spec {
    animation: none;
  }
}
</style>
