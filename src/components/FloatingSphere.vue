<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId } from "vue";
import { pickRandomQuote, type Quote } from "@/data/quotes";
import { msUntilNextHour, pickHourChime } from "@/data/hourChimes";
import {
  FLOATING_SPHERE_POSITION_KEY,
  loadFromStorage,
  saveToStorage,
} from "@/utils/storage";

type PopKind = "quote" | "chime";
type Point = { x: number; y: number };

const GRID = 8;
const CHIME_HIDE_MS = 8000;
const SPHERE_SIZE = 36;
const SPHERE_MARGIN = 24;
const DRAG_THRESHOLD = 4;

const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
const glowId = `led-glow-${uid}`;

const pixels = buildLedDots(GRID);

const rootRef = ref<HTMLElement | null>(null);
const ready = ref(false);
const isDragging = ref(false);
const popKind = ref<PopKind | null>(null);
const activeQuote = ref<Quote | null>(null);
const chimeText = ref("");
const popoverRef = ref<HTMLElement | null>(null);
const popoverStyle = ref<Record<string, string>>({});
const position = ref<Point>({ x: 0, y: 0 });

let chimeTimer: ReturnType<typeof setTimeout> | null = null;
let chimeHideTimer: ReturnType<typeof setTimeout> | null = null;
let suppressNextClick = false;
let dragSession: {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
} | null = null;

const sphereStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
}));

function clampPosition(x: number, y: number): Point {
  const width = rootRef.value?.offsetWidth ?? SPHERE_SIZE;
  const height = rootRef.value?.offsetHeight ?? SPHERE_SIZE;
  return {
    x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
    y: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
  };
}

function defaultPosition(): Point {
  return clampPosition(
    window.innerWidth - SPHERE_SIZE - SPHERE_MARGIN,
    window.innerHeight - SPHERE_SIZE - SPHERE_MARGIN,
  );
}

function loadPosition(): Point {
  const saved = loadFromStorage<Point | null>(
    FLOATING_SPHERE_POSITION_KEY,
    null,
  );
  if (
    saved &&
    typeof saved.x === "number" &&
    typeof saved.y === "number" &&
    Number.isFinite(saved.x) &&
    Number.isFinite(saved.y)
  ) {
    return clampPosition(saved.x, saved.y);
  }
  return defaultPosition();
}

function savePosition() {
  saveToStorage(FLOATING_SPHERE_POSITION_KEY, position.value);
}

function mixLedColor(t: number, light: number): string {
  const palette = [
    [196, 181, 253],
    [125, 211, 252],
    [34, 211, 238],
    [103, 232, 249],
    [165, 243, 252],
    [236, 254, 255],
  ];
  const u = Math.min(0.999, Math.max(0, t * 0.45 + light * 0.55));
  const scaled = u * (palette.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = palette[i];
  const b = palette[i + 1] ?? a;
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hash01(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function buildLedDots(grid: number) {
  const cells: {
    x: number;
    y: number;
    r: number;
    fillDim: string;
    fillLit: string;
    opDim: number;
    opLit: number;
    delay: number;
  }[] = [];
  const cx = (grid - 1) / 2;
  const radius = grid / 2 - 0.05;
  for (let py = 0; py < grid; py++) {
    for (let px = 0; px < grid; px++) {
      const h = hash01(px, py);
      const dx = px - cx;
      const dy = py - cx;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius + 0.55) continue;
      if (dist > radius * 0.72 && h > 0.7) continue;
      if (dist > radius * 0.88 && h > 0.45) continue;
      const nx = px / (grid - 1);
      const ny = py / (grid - 1);
      const light =
        nx * 0.42 + (1 - ny) * 0.28 + Math.max(0, 1 - dist / radius) * 0.4;
      const falloff = Math.max(0, 1 - dist / (radius + 0.35));
      const baseOp = (0.34 + light * 0.52) * (0.38 + falloff * 0.62);
      cells.push({
        x: px + (h - 0.5) * 0.28,
        y: py + (hash01(py, px) - 0.5) * 0.28,
        r: 0.24 + light * 0.1,
        fillDim: mixLedColor(nx, light * 0.42),
        fillLit: mixLedColor(nx, Math.min(1, light * 0.9 + 0.35)),
        opDim: baseOp * 0.55,
        opLit: Math.min(1, baseOp * 1.15),
        delay: dist * 0.32 + h * 0.12,
      });
    }
  }
  return cells;
}

function onSphereClick() {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  void showRandomQuote();
}

function bindDragListeners() {
  window.addEventListener("pointermove", onDragPointerMove);
  window.addEventListener("pointerup", onDragPointerUp);
  window.addEventListener("pointercancel", onDragPointerUp);
}

function unbindDragListeners() {
  window.removeEventListener("pointermove", onDragPointerMove);
  window.removeEventListener("pointerup", onDragPointerUp);
  window.removeEventListener("pointercancel", onDragPointerUp);
}

function onSpherePointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  dragSession = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    originX: position.value.x,
    originY: position.value.y,
    moved: false,
  };
  bindDragListeners();
}

function onDragPointerMove(e: PointerEvent) {
  if (!dragSession || e.pointerId !== dragSession.pointerId) return;
  const dx = e.clientX - dragSession.startX;
  const dy = e.clientY - dragSession.startY;
  if (!dragSession.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  dragSession.moved = true;
  isDragging.value = true;
  position.value = clampPosition(
    dragSession.originX + dx,
    dragSession.originY + dy,
  );
  if (popKind.value) updatePopPosition();
}

function onDragPointerUp(e: PointerEvent) {
  if (!dragSession || e.pointerId !== dragSession.pointerId) return;
  const wasDrag = dragSession.moved;
  dragSession = null;
  isDragging.value = false;
  unbindDragListeners();
  if (!wasDrag) return;
  savePosition();
  suppressNextClick = true;
}

async function openPop() {
  await nextTick();
  updatePopPosition();
}

async function showRandomQuote() {
  clearChimeHide();
  popKind.value = "quote";
  activeQuote.value = pickRandomQuote(activeQuote.value?.id);
  chimeText.value = "";
  await openPop();
}

async function showHourChime() {
  clearChimeHide();
  popKind.value = "chime";
  activeQuote.value = null;
  chimeText.value = pickHourChime();
  await openPop();
  chimeHideTimer = setTimeout(hidePop, CHIME_HIDE_MS);
}

function clearChimeHide() {
  if (!chimeHideTimer) return;
  clearTimeout(chimeHideTimer);
  chimeHideTimer = null;
}

function hidePop() {
  clearChimeHide();
  popKind.value = null;
  activeQuote.value = null;
  chimeText.value = "";
}

function scheduleHourChime() {
  clearHourChime();
  chimeTimer = setTimeout(() => {
    if (document.visibilityState === "visible") {
      void showHourChime();
    }
    scheduleHourChime();
  }, msUntilNextHour());
}

function clearHourChime() {
  if (!chimeTimer) return;
  clearTimeout(chimeTimer);
  chimeTimer = null;
}

function updatePopPosition() {
  const trigger = rootRef.value?.getBoundingClientRect();
  const popover = popoverRef.value;
  if (!trigger || !popover) return;

  const width = popover.offsetWidth;
  const height = popover.offsetHeight;
  let left = trigger.right - width;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

  let top = trigger.top - height - 12;
  if (top < 8) top = trigger.bottom + 12;

  popoverStyle.value = { left: `${left}px`, top: `${top}px` };
}

function onDocumentPointerDown(e: PointerEvent) {
  const target = e.target;
  if (!(target instanceof Node)) return;
  if (!popKind.value) return;
  if (rootRef.value?.contains(target) || popoverRef.value?.contains(target))
    return;
  hidePop();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") hidePop();
}

function onResize() {
  position.value = clampPosition(position.value.x, position.value.y);
  if (popKind.value) updatePopPosition();
}

onMounted(async () => {
  position.value = loadPosition();
  await nextTick();
  ready.value = true;
  scheduleHourChime();
  window.addEventListener("resize", onResize);
  document.addEventListener("pointerdown", onDocumentPointerDown);
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  clearHourChime();
  clearChimeHide();
  unbindDragListeners();
  dragSession = null;
  window.removeEventListener("resize", onResize);
  document.removeEventListener("pointerdown", onDocumentPointerDown);
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      ref="rootRef"
      class="floating-sphere"
      :class="{ 'is-ready': ready, 'is-dragging': isDragging }"
      :style="sphereStyle"
      role="button"
      tabindex="0"
      aria-label="顯示一句引言，可拖曳移動"
      @pointerdown="onSpherePointerDown"
      @click="onSphereClick"
      @keydown.enter.prevent="onSphereClick"
      @keydown.space.prevent="onSphereClick"
    >
      <span class="orb-glow" />
      <svg class="orb" :viewBox="`0 0 ${GRID} ${GRID}`" aria-hidden="true">
        <defs>
          <radialGradient :id="`${glowId}-wash`" cx="52%" cy="40%" r="62%">
            <stop class="wash-in" offset="0%" />
            <stop class="wash-out" offset="100%" />
          </radialGradient>
          <filter :id="glowId" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="0.32"
              result="blur"
            />
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

    <Transition name="quote-pop">
      <aside
        v-if="popKind"
        :key="
          popKind === 'quote'
            ? `quote-${activeQuote?.id}`
            : `chime-${chimeText}`
        "
        ref="popoverRef"
        class="quote-pop"
        :style="popoverStyle"
        role="dialog"
        :aria-label="popKind === 'chime' ? '整點報時' : '引言'"
      >
        <template v-if="popKind === 'quote' && activeQuote">
          <p class="quote-text">「{{ activeQuote.quote }}」</p>
          <p class="quote-author">{{ activeQuote.author_zh }}</p>
        </template>
        <p v-else class="quote-text">{{ chimeText }}</p>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

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

  &.is-dragging {
    cursor: grabbing;
  }

  &::after {
    content: "";
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
  animation: led-tint 3.4s cubic-bezier(0.45, 0, 0.55, 1) var(--delay, 0s)
    infinite;
}

.led-spec {
  fill: #ffffff;
  opacity: 0.2;
  animation: led-spec 3.4s cubic-bezier(0.45, 0, 0.55, 1) var(--delay, 0s)
    infinite;
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

.quote-pop {
  position: fixed;
  z-index: 50;
  width: min(320px, calc(100vw - 24px));
  padding: 14px 16px 12px;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(103, 232, 249, 0.35);
  border-radius: $radius;
  box-shadow:
    0 10px 28px rgba(34, 211, 238, 0.12),
    $shadow-lg;
  color: $text;
  pointer-events: auto;
}

.quote-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.75;
}

.quote-author {
  text-align: right;
  font-size: 12px;
  color: $text-muted;
}

.quote-pop-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(0.34, 1.35, 0.64, 1);
}

.quote-pop-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.quote-pop-enter-from,
.quote-pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.94);
}
</style>
