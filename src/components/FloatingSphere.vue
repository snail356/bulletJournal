<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, useId } from "vue";
import { pickRandomQuote, type Quote } from "@/data/quotes";
import { msUntilNextHour, pickHourChime } from "@/data/hourChimes";
import {
  AURORA_MODE_KEY,
  loadFromStorage,
  saveToStorage,
} from "@/utils/storage";

type AuroraMode = "quote" | "hourly";
type PopKind = "quote" | "chime";

const SIZE = 36;
const GRID = 8;
const MARGIN = 24;
const SHADOW_ROOM = 14;
const DRAG_THRESHOLD_PX = 5;
const CHIME_HIDE_MS = 8000;

const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
const glowId = `led-glow-${uid}`;

const pixels = buildLedDots(GRID);

const rootRef = ref<HTMLElement | null>(null);
const x = ref(
  typeof window !== "undefined"
    ? Math.max(8, window.innerWidth - SIZE - MARGIN)
    : 0,
);
const y = ref(
  typeof window !== "undefined"
    ? Math.max(8, window.innerHeight - SIZE - MARGIN)
    : 0,
);
const ready = ref(false);
const dragging = ref(false);
const savedMode = loadFromStorage<AuroraMode>(AURORA_MODE_KEY, "quote");
const mode = ref<AuroraMode>(savedMode === "hourly" ? "hourly" : "quote");
const popKind = ref<PopKind | null>(null);
const activeQuote = ref<Quote | null>(null);
const chimeText = ref("");
const popoverRef = ref<HTMLElement | null>(null);
const popoverStyle = ref<Record<string, string>>({});
const modeMenuOpen = ref(false);
const modeMenuStyle = ref<Record<string, string>>({});
const modeMenuRef = ref<HTMLElement | null>(null);

let hasDragged = false;
let pointerMoved = false;
let startPointerX = 0;
let startPointerY = 0;
let startX = 0;
let startY = 0;
let pointerId: number | null = null;
let chimeTimer: ReturnType<typeof setTimeout> | null = null;
let chimeHideTimer: ReturnType<typeof setTimeout> | null = null;

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

function size(): number {
  const w = rootRef.value?.offsetWidth ?? 0;
  return w > 0 ? w : SIZE;
}

function clamp(px: number, py: number) {
  const s = size();
  const maxX = Math.max(8, window.innerWidth - s - 8);
  const maxY = Math.max(8, window.innerHeight - s - SHADOW_ROOM);
  return {
    x: Math.min(Math.max(8, px), maxX),
    y: Math.min(Math.max(8, py), maxY),
  };
}

function placeAtBottomRight() {
  const s = size();
  const next = clamp(
    window.innerWidth - s - MARGIN,
    window.innerHeight - s - MARGIN,
  );
  x.value = next.x;
  y.value = next.y;
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  pointerMoved = false;
  dragging.value = false;
  pointerId = e.pointerId;
  startPointerX = e.clientX;
  startPointerY = e.clientY;
  startX = x.value;
  startY = y.value;
  rootRef.value?.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (pointerId === null || e.pointerId !== pointerId) return;
  const dx = e.clientX - startPointerX;
  const dy = e.clientY - startPointerY;
  if (!pointerMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
  pointerMoved = true;
  dragging.value = true;
  hasDragged = true;
  const next = clamp(startX + dx, startY + dy);
  x.value = next.x;
  y.value = next.y;
  if (activeQuote.value || chimeText.value) updatePopPosition();
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerId !== pointerId) return;
  const wasClick = !pointerMoved;
  dragging.value = false;
  pointerId = null;
  if (wasClick) onSphereClick();
}

function onSphereClick() {
  if (mode.value === "hourly") showHourChime();
  else showRandomQuote();
}

function estimatePopStyle() {
  const width = Math.min(320, window.innerWidth - 24);
  const left = Math.max(
    8,
    Math.min(x.value + SIZE - width, window.innerWidth - width - 8),
  );
  const top = Math.max(8, y.value - 12);
  popoverStyle.value = { left: `${left}px`, top: `${top}px` };
}

async function openPop() {
  estimatePopStyle();
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

function setMode(next: AuroraMode) {
  mode.value = next;
  saveToStorage(AURORA_MODE_KEY, next);
  modeMenuOpen.value = false;
}

function openModeMenu(e: MouseEvent) {
  e.preventDefault();
  modeMenuOpen.value = true;
  const left = Math.max(8, Math.min(e.clientX, window.innerWidth - 168));
  const top = Math.max(8, Math.min(e.clientY, window.innerHeight - 96));
  modeMenuStyle.value = { left: `${left}px`, top: `${top}px` };
}

function scheduleHourChime() {
  clearHourChime();
  chimeTimer = setTimeout(() => {
    if (mode.value === "hourly" && document.visibilityState === "visible") {
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
  if (modeMenuRef.value?.contains(target)) return;
  if (modeMenuOpen.value) modeMenuOpen.value = false;
  if (!popKind.value) return;
  if (rootRef.value?.contains(target) || popoverRef.value?.contains(target))
    return;
  hidePop();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    modeMenuOpen.value = false;
    hidePop();
  }
}

function onResize() {
  if (hasDragged) {
    const next = clamp(x.value, y.value);
    x.value = next.x;
    y.value = next.y;
  } else {
    placeAtBottomRight();
  }
  if (popKind.value) updatePopPosition();
}

onMounted(async () => {
  await nextTick();
  placeAtBottomRight();
  ready.value = true;
  scheduleHourChime();
  window.addEventListener("resize", onResize);
  document.addEventListener("pointerdown", onDocumentPointerDown);
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  clearHourChime();
  clearChimeHide();
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
      :class="{ 'is-dragging': dragging, 'is-ready': ready }"
      :style="{ left: `${x}px`, top: `${y}px` }"
      role="button"
      tabindex="0"
      :aria-label="mode === 'hourly' ? '整點報時' : '顯示一句引言'"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @contextmenu="openModeMenu"
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
        :key="popKind === 'quote' ? `quote-${activeQuote?.id}` : `chime-${chimeText}`"
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

    <div
      v-if="modeMenuOpen"
      ref="modeMenuRef"
      class="mode-menu"
      :style="modeMenuStyle"
      @pointerdown.stop
    >
      <p class="mode-menu-label">模式</p>
      <button
        type="button"
        :class="{ active: mode === 'quote' }"
        @click="setMode('quote')"
      >
        引言
      </button>
      <button
        type="button"
        :class="{ active: mode === 'hourly' }"
        @click="setMode('hourly')"
      >
        整點報時
      </button>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.floating-sphere {
  position: fixed;
  width: 36px;
  height: 36px;
  z-index: 36;
  cursor: pointer;
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
  margin: 12px 0 0;
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

.mode-menu {
  position: fixed;
  z-index: 60;
  min-width: 148px;
  padding: 6px;
  background: $surface;
  border: 1px solid $border;
  border-radius: $radius-sm;
  box-shadow: $shadow-lg;
  display: flex;
  flex-direction: column;
}

.mode-menu-label {
  margin: 0;
  padding: 6px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
}

.mode-menu button {
  text-align: left;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: $text;

  &:hover {
    background: $bg;
  }

  &.active {
    background: $primary-light;
    color: $primary-dark;
    font-weight: 600;
  }
}
</style>
