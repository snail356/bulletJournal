<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const SIZE = 36
const GRID = 12
const MARGIN = 24
const SHADOW_ROOM = 14

const SHADES = ['#4c1d95', '#5b21b6', '#7c3aed', '#a78bfa', '#ddd6fe', '#f5f3ff']

const pixels = buildPixelSphere(GRID, SHADES)

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

function buildPixelSphere(grid: number, shades: string[]) {
  const cells: { x: number; y: number; fill: string; opacity: number }[] = []
  const cx = (grid - 1) / 2
  const r = grid / 2 - 0.3
  for (let py = 0; py < grid; py++) {
    for (let px = 0; px < grid; px++) {
      const dx = px - cx
      const dy = py - cx
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > r) continue
      const light = (-dx - dy) / (r * Math.SQRT2)
      const shade = Math.min(1, Math.max(0, 0.42 + light * 0.42 + (1 - dist / r) * 0.18))
      const idx = Math.min(shades.length - 1, Math.floor(shade * shades.length))
      const rim = Math.max(0, dist - (r - 1.35))
      const opacity = 1 - rim * 0.42
      cells.push({ x: px, y: py, fill: shades[idx], opacity })
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
      <svg
        class="orb"
        :viewBox="`0 0 ${GRID} ${GRID}`"
        shape-rendering="crispEdges"
        aria-hidden="true"
      >
        <rect
          v-for="p in pixels"
          :key="`${p.x}-${p.y}`"
          :x="p.x"
          :y="p.y"
          width="1"
          height="1"
          :fill="p.fill"
          :opacity="p.opacity"
        />
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
      rgba(17, 12, 28, 0.38) 0%,
      rgba(17, 12, 28, 0.14) 48%,
      transparent 72%
    );
    transform: translateX(-50%);
    pointer-events: none;
    filter: blur(1.5px);
    animation: shadow-breathe 3.2s ease-in-out infinite;
  }

  &.is-dragging {
    cursor: grabbing;
    z-index: 45;

    .orb,
    .orb-glow {
      animation: none;
      transform: translateY(-5px) scale(1.04);
    }

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
  animation: sphere-float 3.2s ease-in-out infinite;
}

.orb-glow {
  inset: -6px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 34% 32%,
    rgba(237, 233, 254, 0.95) 0%,
    rgba(167, 139, 250, 0.7) 32%,
    rgba(124, 58, 237, 0.45) 58%,
    transparent 78%
  );
  filter: blur(5px);
}

.orb {
  width: 100%;
  height: 100%;
  overflow: visible;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

@keyframes sphere-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes shadow-breathe {
  0%,
  100% {
    transform: translateX(-50%) scale(1);
    opacity: 0.9;
  }
  50% {
    transform: translateX(-50%) scale(1.16);
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .floating-sphere::after,
  .orb,
  .orb-glow {
    animation: none;
  }
}
</style>
