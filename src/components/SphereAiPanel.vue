<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import MarkdownContent from "@/components/MarkdownContent.vue";
import { useTaskStore } from "@/stores/taskStore";
import {
  SPHERE_AI_QUESTION_LIMIT,
  SPHERE_AI_QUESTIONS,
  type SphereAiTurn,
} from "@/utils/sphereAi";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
}

const MIN_WIDTH = 600;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 460;
const MIN_HEIGHT = 500;
const MAX_HEIGHT = 720;
const DEFAULT_HEIGHT = 360;
const EDGE = 8;
const SPHERE_SIZE = 36;
const DRAG_THRESHOLD = 4;

interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DragMode = "move" | "left" | "right" | "top" | "bottom" | "top-left";

const props = defineProps<{
  anchorX: number;
  anchorY: number;
}>();

const emit = defineEmits<{
  close: [];
}>();

const store = useTaskStore();
const rootRef = ref<HTMLElement | null>(null);
const threadRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | null>(null);
const question = ref("");
const error = ref("");
const messages = ref<ChatMessage[]>([]);
const frame = ref<Frame>({
  x: EDGE,
  y: EDGE,
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
});
const dragging = ref(false);
let nextId = 0;
let dragSession: {
  pointerId: number;
  mode: DragMode;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
  moved: boolean;
} | null = null;

const panelStyle = computed(() => ({
  left: `${frame.value.x}px`,
  top: `${frame.value.y}px`,
  width: `${frame.value.width}px`,
  height: `${frame.value.height}px`,
}));

const canAsk = computed(
  () => question.value.trim().length > 0 && !store.sphereAiLoading,
);

function completedTurns(): SphereAiTurn[] {
  const turns: SphereAiTurn[] = [];
  const list = messages.value;
  for (let i = 0; i < list.length - 1; i++) {
    const current = list[i];
    const next = list[i + 1];
    if (current?.role === "user" && next?.role === "assistant") {
      turns.push({ question: current.text, answer: next.text });
      i += 1;
    }
  }
  return turns;
}

function maxWidth() {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - EDGE * 2));
}

function clampWidth(width: number) {
  return Math.round(Math.min(maxWidth(), Math.max(MIN_WIDTH, width)));
}

function maxHeight() {
  return Math.max(
    MIN_HEIGHT,
    Math.min(MAX_HEIGHT, window.innerHeight - EDGE * 2),
  );
}

function clampHeight(height: number) {
  return Math.round(Math.min(maxHeight(), Math.max(MIN_HEIGHT, height)));
}

function clampFrame(next: Frame): Frame {
  const width = clampWidth(next.width);
  const height = clampHeight(next.height);
  return {
    width,
    height,
    x: Math.round(
      Math.min(
        Math.max(EDGE, next.x),
        Math.max(EDGE, window.innerWidth - width - EDGE),
      ),
    ),
    y: Math.round(
      Math.min(
        Math.max(EDGE, next.y),
        Math.max(EDGE, window.innerHeight - height - EDGE),
      ),
    ),
  };
}

function placeNearSphere() {
  const width = clampWidth(DEFAULT_WIDTH);
  const height = clampHeight(DEFAULT_HEIGHT);
  const x = props.anchorX + SPHERE_SIZE - width;
  const gap = 12;
  const spaceAbove = props.anchorY - gap - EDGE;
  const spaceBelow =
    window.innerHeight - (props.anchorY + SPHERE_SIZE) - gap - EDGE;
  const placeAbove = spaceAbove >= height || spaceAbove >= spaceBelow;
  const y = placeAbove
    ? props.anchorY - height - gap
    : props.anchorY + SPHERE_SIZE + gap;
  frame.value = clampFrame({ x, y, width, height });
}

function beginDrag(e: PointerEvent, mode: DragMode) {
  if (e.button !== 0) return;
  const handle = e.currentTarget;
  if (handle instanceof HTMLElement) {
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture needs a live pointer; mouse fallback still tracks the gesture.
    }
  }
  dragSession = {
    pointerId: e.pointerId,
    mode,
    startX: e.clientX,
    startY: e.clientY,
    originX: frame.value.x,
    originY: frame.value.y,
    originWidth: frame.value.width,
    originHeight: frame.value.height,
    moved: false,
  };
}

function onHeaderPointerDown(e: PointerEvent) {
  if (
    e.target instanceof Element &&
    e.target.closest("button, a, input, textarea")
  )
    return;
  beginDrag(e, "move");
}

function onResizePointerDown(e: PointerEvent, mode: Exclude<DragMode, "move">) {
  beginDrag(e, mode);
}

function onDragPointerMove(e: PointerEvent) {
  if (!dragSession || e.pointerId !== dragSession.pointerId) return;
  const dx = e.clientX - dragSession.startX;
  const dy = e.clientY - dragSession.startY;
  if (!dragSession.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  dragSession.moved = true;
  dragging.value = true;
  const origin = dragSession;
  if (origin.mode === "move") {
    frame.value = clampFrame({
      x: origin.originX + dx,
      y: origin.originY + dy,
      width: origin.originWidth,
      height: origin.originHeight,
    });
    return;
  }
  if (origin.mode === "right") {
    frame.value = clampFrame({
      x: origin.originX,
      y: origin.originY,
      width: origin.originWidth + dx,
      height: origin.originHeight,
    });
    return;
  }
  if (origin.mode === "left") {
    const width = clampWidth(origin.originWidth - dx);
    frame.value = clampFrame({
      x: origin.originX + origin.originWidth - width,
      y: origin.originY,
      width,
      height: origin.originHeight,
    });
    return;
  }
  if (origin.mode === "bottom") {
    const height = Math.min(
      clampHeight(origin.originHeight + dy),
      Math.max(MIN_HEIGHT, window.innerHeight - EDGE - origin.originY),
    );
    frame.value = clampFrame({
      x: origin.originX,
      y: origin.originY,
      width: origin.originWidth,
      height,
    });
    return;
  }
  if (origin.mode === "top") {
    const bottom = origin.originY + origin.originHeight;
    const height = Math.min(
      clampHeight(origin.originHeight - dy),
      Math.max(MIN_HEIGHT, bottom - EDGE),
    );
    frame.value = clampFrame({
      x: origin.originX,
      y: bottom - height,
      width: origin.originWidth,
      height,
    });
    return;
  }
  const right = origin.originX + origin.originWidth;
  const bottom = origin.originY + origin.originHeight;
  const width = Math.min(
    clampWidth(origin.originWidth - dx),
    Math.max(MIN_WIDTH, right - EDGE),
  );
  const height = Math.min(
    clampHeight(origin.originHeight - dy),
    Math.max(MIN_HEIGHT, bottom - EDGE),
  );
  frame.value = clampFrame({
    x: right - width,
    y: bottom - height,
    width,
    height,
  });
}

function onDragPointerUp(e: PointerEvent) {
  if (!dragSession || e.pointerId !== dragSession.pointerId) return;
  onDragPointerMove(e);
  dragSession = null;
  dragging.value = false;
}

function onWindowResize() {
  frame.value = clampFrame(frame.value);
}

async function scrollThread() {
  await nextTick();
  const thread = threadRef.value;
  if (thread) thread.scrollTop = thread.scrollHeight;
}

async function requestAsk(text = question.value) {
  const trimmed = text.trim();
  if (!trimmed || store.sphereAiLoading) return;
  error.value = "";
  const history = completedTurns();
  messages.value.push({ id: nextId++, role: "user", text: trimmed });
  question.value = "";
  await scrollThread();
  await focusInput();
  try {
    const answer = await store.askSphereQuestion(trimmed, history);
    messages.value.push({ id: nextId++, role: "assistant", text: answer });
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "詢問 AI 失敗";
  }
  await scrollThread();
  await focusInput();
}

async function focusInput() {
  await nextTick();
  inputRef.value?.focus();
}

function onQuestionKeydown(e: KeyboardEvent) {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
  e.preventDefault();
  void requestAsk();
}

function onDocumentPointerDown(e: PointerEvent) {
  const target = e.target;
  if (!(target instanceof Node)) return;
  if (rootRef.value?.contains(target)) return;
  if (target instanceof Element && target.closest(".floating-sphere")) return;
  emit("close");
}

watch(
  () => store.sphereAiLoading,
  () => {
    void scrollThread();
  },
);

onMounted(async () => {
  document.addEventListener("pointerdown", onDocumentPointerDown);
  window.addEventListener("resize", onWindowResize);
  localStorage.removeItem("bullet-journal-sphere-ai-frame");
  placeNearSphere();
  await focusInput();
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown);
  window.removeEventListener("resize", onWindowResize);
  dragSession = null;
});

defineExpose({ rootRef });
</script>

<template>
  <aside
    ref="rootRef"
    class="sphere-ai"
    :class="{ 'is-dragging': dragging }"
    :style="panelStyle"
    role="dialog"
    aria-label="詢問 AI"
    @contextmenu.prevent
    @dragstart.prevent
  >
    <div
      class="resize resize-left"
      role="separator"
      aria-orientation="vertical"
      aria-label="調整寬度"
      @pointerdown="onResizePointerDown($event, 'left')"
      @pointermove="onDragPointerMove"
      @pointerup="onDragPointerUp"
      @pointercancel="onDragPointerUp"
    />
    <div
      class="resize resize-right"
      role="separator"
      aria-orientation="vertical"
      aria-label="調整寬度"
      @pointerdown="onResizePointerDown($event, 'right')"
      @pointermove="onDragPointerMove"
      @pointerup="onDragPointerUp"
      @pointercancel="onDragPointerUp"
    />
    <div
      class="resize resize-top"
      role="separator"
      aria-orientation="horizontal"
      aria-label="調整高度"
      @pointerdown="onResizePointerDown($event, 'top')"
      @pointermove="onDragPointerMove"
      @pointerup="onDragPointerUp"
      @pointercancel="onDragPointerUp"
    />
    <div
      class="resize resize-bottom"
      role="separator"
      aria-orientation="horizontal"
      aria-label="調整高度"
      @pointerdown="onResizePointerDown($event, 'bottom')"
      @pointermove="onDragPointerMove"
      @pointerup="onDragPointerUp"
      @pointercancel="onDragPointerUp"
    />
    <div
      class="resize resize-top-left"
      role="separator"
      aria-label="調整大小"
      @pointerdown="onResizePointerDown($event, 'top-left')"
      @pointermove="onDragPointerMove"
      @pointerup="onDragPointerUp"
      @pointercancel="onDragPointerUp"
    />
    <header
      class="head"
      @pointerdown="onHeaderPointerDown"
      @pointermove="onDragPointerMove"
      @pointerup="onDragPointerUp"
      @pointercancel="onDragPointerUp"
    >
      <h2>詢問 AI</h2>
      <button
        type="button"
        class="close"
        aria-label="關閉"
        @click="emit('close')"
      >
        關閉
      </button>
    </header>
    <div ref="threadRef" class="thread">
      <div
        v-for="message in messages"
        :key="message.id"
        class="bubble"
        :class="message.role"
      >
        <MarkdownContent
          v-if="message.role === 'assistant'"
          :content="message.text"
        />
        <p v-else class="user-text">{{ message.text }}</p>
      </div>
      <p v-if="store.sphereAiLoading" class="bubble assistant pending">
        正在整理回答…
      </p>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
    <div class="presets">
      <button
        v-for="item in SPHERE_AI_QUESTIONS"
        :key="item.key"
        type="button"
        :disabled="store.sphereAiLoading"
        @click="requestAsk(item.question)"
      >
        {{ item.label }}
      </button>
    </div>
    <form class="ask" @submit.prevent="requestAsk()">
      <textarea
        ref="inputRef"
        v-model="question"
        :maxlength="SPHERE_AI_QUESTION_LIMIT"
        rows="2"
        placeholder="今天進度如何？還有哪些未完成代辦？"
        @keydown="onQuestionKeydown"
      />
      <button type="submit" class="send" :disabled="!canAsk">
        {{ store.sphereAiLoading ? "詢問中…" : "送出" }}
      </button>
    </form>
  </aside>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.sphere-ai {
  position: fixed;
  z-index: 50;
  display: flex;
  flex-direction: column;
  width: min(460px, calc(100vw - 16px));
  height: 360px;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  overflow: hidden;
  padding: 14px 14px 12px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(103, 232, 249, 0.35);
  border-radius: $radius;
  box-shadow:
    0 10px 28px rgba(34, 211, 238, 0.12),
    $shadow-lg;
  color: $text;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: grab;
  touch-action: none;
  user-select: none;

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    cursor: grab;
  }
}

.sphere-ai.is-dragging .head,
.sphere-ai.is-dragging .head h2 {
  cursor: grabbing;
}

.resize {
  position: absolute;
  touch-action: none;
  z-index: 1;

  &::before {
    content: "";
    position: absolute;
    border-radius: 2px;
    background: rgba(14, 116, 144, 0.28);
    opacity: 0;
  }

  &:hover::before {
    opacity: 1;
  }
}

.resize-left,
.resize-right {
  top: 12px;
  bottom: 12px;
  width: 10px;
  cursor: ew-resize;

  &::before {
    top: 50%;
    width: 3px;
    height: 28px;
    margin-top: -14px;
  }
}

.resize-left {
  left: 0;

  &::before {
    left: 3px;
  }
}

.resize-right {
  right: 0;

  &::before {
    right: 3px;
  }
}

.resize-top,
.resize-bottom {
  left: 12px;
  right: 12px;
  height: 10px;
  cursor: ns-resize;

  &::before {
    left: 50%;
    width: 28px;
    height: 3px;
    margin-left: -14px;
  }
}

.resize-top {
  top: 0;

  &::before {
    top: 3px;
  }
}

.resize-bottom {
  bottom: 0;

  &::before {
    bottom: 3px;
  }
}

.resize-top-left {
  top: 0;
  left: 0;
  z-index: 2;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;

  &::before {
    top: 4px;
    left: 4px;
    width: 8px;
    height: 8px;
    background: transparent;
    border-top: 2px solid rgba(14, 116, 144, 0.45);
    border-left: 2px solid rgba(14, 116, 144, 0.45);
    border-radius: 2px 0 0 0;
  }
}

.close,
.presets button,
.send {
  border-radius: $radius-sm;
  font-size: 12px;
}

.close {
  padding: 4px 8px;
  cursor: pointer;
  color: $text-muted;

  &:hover {
    background: $bg;
    color: $text;
  }
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
  flex-shrink: 0;

  button {
    padding: 5px 10px;
    color: #0e7490;
    background: rgba(207, 250, 254, 0.55);
    border: 1px solid rgba(103, 232, 249, 0.45);

    &:hover:not(:disabled) {
      background: rgba(165, 243, 252, 0.7);
    }

    &:disabled {
      opacity: 0.55;
    }
  }
}

.thread {
  flex: 1;
  min-height: 0;
  margin-top: 12px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bubble {
  margin: 0;
  max-width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.6;

  &.user {
    align-self: flex-end;
    max-width: 92%;
    background: rgba(207, 250, 254, 0.75);
  }

  &.assistant {
    background: $bg;

    :deep(.markdown-body) {
      h1,
      h2,
      h3 {
        margin: 8px 0 4px;
        font-size: 14px;
      }

      p,
      ul,
      ol {
        margin: 4px 0;
      }

      ul,
      ol {
        padding-left: 18px;
      }
    }
  }

  &.pending {
    align-self: flex-start;
    color: $text-muted;
  }
}

.user-text {
  margin: 0;
  white-space: pre-wrap;
}

.ask {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-top: 8px;
  flex-shrink: 0;
}

textarea {
  flex: 1;
  width: auto;
  min-width: 0;
  resize: vertical;
  min-height: 58px;
  padding: 8px 10px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $surface;
  color: $text;
  font: inherit;
  font-size: 13px;
  line-height: 1.55;

  &:focus {
    outline: 2px solid rgba(34, 211, 238, 0.45);
    border-color: transparent;
  }

  &:disabled {
    background: $bg;
  }
}

.send {
  flex-shrink: 0;
  min-width: 64px;
  height: 36px;
  padding: 0 14px;
  background: #0891b2;
  color: white;
  font-weight: 600;

  &:hover:not(:disabled) {
    background: #0e7490;
  }

  &:disabled {
    opacity: 0.5;
  }
}

.error {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #b91c1c;
}
</style>
