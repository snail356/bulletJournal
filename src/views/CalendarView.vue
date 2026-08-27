<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Task } from '@/types'
import AppIcon from '@/components/AppIcon.vue'
import CalendarMonthCard from '@/components/CalendarMonthCard.vue'
import CalendarTaskBlock from '@/components/CalendarTaskBlock.vue'
import TaskFormModal from '@/components/TaskFormModal.vue'
import { useCalendarDrag, type CalendarDragMode } from '@/composables/useCalendarDrag'
import { useTaskStore } from '@/stores/taskStore'
import { getLabelBgForColor } from '@/utils/labelColors'
import {
  layoutWeekSegments,
  weekDateStrings,
  type WeekLayout,
} from '@/utils/calendarLayout'
import {
  addDays,
  formatDate,
  getFilledCalendarWeeks,
  getQuarter,
  getQuarterMonths,
  getTaskDuration,
  getTaskEndDate,
  getWeekDates,
  parseDateString,
  todayString,
} from '@/utils/date'

type CalendarMode = 'week' | 'month' | 'quarter' | 'year'

const store = useTaskStore()
const router = useRouter()
const mode = ref<CalendarMode>('month')
const viewDate = ref(parseDateString(store.selectedDate))
const showCreateModal = ref(false)
const createDate = ref(todayString())
const weekEls = ref<(HTMLElement | null)[]>([])

const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const today = todayString()

const year = computed(() => viewDate.value.getFullYear())
const month = computed(() => viewDate.value.getMonth())

const periodLabel = computed(() => {
  if (mode.value === 'year') return `${year.value} 年`
  if (mode.value === 'quarter') {
    const quarter = getQuarter(viewDate.value)
    const startMonth = (quarter - 1) * 3 + 1
    return `${year.value} 年第 ${quarter} 季（${startMonth}–${startMonth + 2} 月）`
  }
  if (mode.value === 'month') {
    return `${year.value} 年 ${month.value + 1} 月`
  }
  const days = getWeekDates(viewDate.value)
  const start = days[0]
  const end = days[6]
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) {
    return `${start.getFullYear()} 年 ${start.getMonth() + 1} 月 ${start.getDate()}–${end.getDate()} 日`
  }
  return `${start.getMonth() + 1}月${start.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`
})

const overviewMonths = computed(() => {
  if (mode.value === 'year') {
    return Array.from({ length: 12 }, (_, index) => ({
      year: year.value,
      month: index,
    }))
  }
  if (mode.value === 'quarter') {
    return getQuarterMonths(year.value, getQuarter(viewDate.value))
  }
  return []
})

const taskDates = computed(() => store.getTaskDatesWithActivity())
const isOverview = computed(() => mode.value === 'quarter' || mode.value === 'year')

const weekRows = computed(() => {
  if (mode.value === 'week') return [getWeekDates(viewDate.value)]
  if (mode.value === 'month') return getFilledCalendarWeeks(year.value, month.value)
  return []
})

function isOutsideMonth(date: Date) {
  return date.getMonth() !== month.value
}

function hitTestDate(x: number, y: number): string | null {
  const count = weekRows.value.length
  for (let i = 0; i < count; i++) {
    const el = weekEls.value[i]
    const row = weekRows.value[i]
    if (!el || !row) continue
    const rect = el.getBoundingClientRect()
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue
    const col = Math.min(
      6,
      Math.max(0, Math.floor((x - rect.left) / (rect.width / 7))),
    )
    return formatDate(row[col])
  }
  return null
}

const {
  beginDrag: startCalendarDrag,
  draggingTaskId,
  dragMode,
  preview,
  previewByTask,
  pointerPos,
  consumeClickSuppression,
} = useCalendarDrag({
  hitTestDate,
  onCommit(taskId, next) {
    store.setTaskDateRange(taskId, next.date, next.endDate)
  },
})

const layouts = computed<WeekLayout[]>(() =>
  weekRows.value.map((days) =>
    layoutWeekSegments(store.tasks, weekDateStrings(days), previewByTask.value),
  ),
)

const tasksById = computed(() => {
  const map = new Map<string, Task>()
  for (const task of store.tasks) map.set(task.id, task)
  return map
})

function displayedTask(taskId: string): Task | undefined {
  const task = tasksById.value.get(taskId)
  if (!task) return undefined
  const next = previewByTask.value[taskId]
  if (!next) return task
  return { ...task, date: next.date, endDate: next.endDate }
}

function taskColors(task: Task) {
  const labelId = task.labels[0]
  const label = labelId ? store.labels.find((item) => item.id === labelId) : undefined
  if (label) {
    return { color: label.color, bgColor: getLabelBgForColor(label.color) }
  }
  const status = store.getStatusItem(task.status)
  return { color: status.color, bgColor: status.bgColor }
}

const laneRowSize = computed(() => (mode.value === 'week' ? 28 : 22))
const subtitleText = computed(() => {
  if (isOverview.value) {
    return '點月份可切到月檢視；點日期可選取，連點可新增任務'
  }
  return '拖曳任務中間可平移整段（天數不變）；懸停左右邊緣出現雙向箭頭，可單獨調整開始或結束日期'
})

function weekMinHeight(index: number) {
  const lanes = layouts.value[index]?.laneCount ?? 1
  return Math.max(112, 36 + lanes * 25)
}

function shouldShowWeekMonth(date: Date, days: Date[]) {
  return date.getDate() === 1 || formatDate(date) === formatDate(days[0])
}

function goPrev() {
  if (mode.value === 'year') {
    viewDate.value = new Date(year.value - 1, month.value, 1)
    return
  }
  if (mode.value === 'quarter') {
    viewDate.value = new Date(year.value, month.value - 3, 1)
    return
  }
  if (mode.value === 'month') {
    viewDate.value = new Date(year.value, month.value - 1, 1)
    return
  }
  viewDate.value = parseDateString(addDays(formatDate(viewDate.value), -7))
}

function goNext() {
  if (mode.value === 'year') {
    viewDate.value = new Date(year.value + 1, month.value, 1)
    return
  }
  if (mode.value === 'quarter') {
    viewDate.value = new Date(year.value, month.value + 3, 1)
    return
  }
  if (mode.value === 'month') {
    viewDate.value = new Date(year.value, month.value + 1, 1)
    return
  }
  viewDate.value = parseDateString(addDays(formatDate(viewDate.value), 7))
}

function openMonth(nextYear: number, nextMonth: number) {
  viewDate.value = new Date(nextYear, nextMonth, 1)
  mode.value = 'month'
}

function goToday() {
  viewDate.value = parseDateString(todayString())
  store.setSelectedDate(todayString())
}

function selectDay(date: Date) {
  if (consumeClickSuppression()) return
  store.setSelectedDate(formatDate(date))
}

function openCreate(date: Date) {
  createDate.value = formatDate(date)
  showCreateModal.value = true
}

function setWeekEl(index: number, el: unknown) {
  weekEls.value[index] = el instanceof HTMLElement ? el : null
}

function beginDrag(
  event: PointerEvent,
  taskId: string,
  mode: CalendarDragMode,
) {
  const task = tasksById.value.get(taskId)
  if (!task) return
  const anchorDate = hitTestDate(event.clientX, event.clientY) ?? task.date
  startCalendarDrag(event, {
    taskId: task.id,
    mode,
    originStart: task.date,
    originEndStored: task.endDate,
    originEffectiveEnd: getTaskEndDate(task),
    anchorDate,
  })
}

function onSelectTask(taskId: string) {
  if (consumeClickSuppression()) return
  router.push(`/tasks/${taskId}`)
}

const previewHint = computed(() => {
  if (!preview.value || !draggingTaskId.value) return ''
  const duration = getTaskDuration(preview.value)
  const modeLabel =
    dragMode.value === 'move'
      ? '平移整段'
      : dragMode.value === 'resize-start'
        ? '調整開始日期'
        : '調整結束日期'
  const end = preview.value.endDate ?? preview.value.date
  const range = preview.value.endDate
    ? `${preview.value.date} ～ ${end}`
    : preview.value.date
  return `${modeLabel} · ${range} · ${duration} 天`
})

const HINT_GAP = 8
const HINT_MAX_WIDTH = 320
const HINT_HEIGHT = 36

const hintStyle = computed(() => {
  const pos = pointerPos.value
  if (!pos) return undefined
  const x = Math.min(
    window.innerWidth - 8,
    Math.max(HINT_MAX_WIDTH + 8, pos.x - HINT_GAP),
  )
  const y = Math.min(
    window.innerHeight - 8,
    Math.max(HINT_HEIGHT + 8, pos.y - HINT_GAP),
  )
  return {
    left: `${x}px`,
    top: `${y}px`,
    transform: 'translate(-100%, -100%)',
  }
})
</script>

<template>
  <div
    class="calendar-view"
    :class="{
      dragging: Boolean(draggingTaskId),
      resizing: dragMode === 'resize-start' || dragMode === 'resize-end',
      'week-mode': mode === 'week',
      'overview-mode': isOverview,
    }"
  >
    <header class="page-header">
      <div>
        <h1>日曆</h1>
        <p class="subtitle">
          {{ subtitleText }}
        </p>
      </div>
      <div class="header-actions">
        <div class="mode-toggle" role="tablist" aria-label="檢視模式">
          <button
            type="button"
            :class="{ active: mode === 'week' }"
            @click="mode = 'week'"
          >
            週
          </button>
          <button
            type="button"
            :class="{ active: mode === 'month' }"
            @click="mode = 'month'"
          >
            月
          </button>
          <button
            type="button"
            :class="{ active: mode === 'quarter' }"
            @click="mode = 'quarter'"
          >
            季
          </button>
          <button
            type="button"
            :class="{ active: mode === 'year' }"
            @click="mode = 'year'"
          >
            年
          </button>
        </div>
        <div class="period-nav">
          <button type="button" class="nav-btn" aria-label="上一段" @click="goPrev">
            <AppIcon name="chevron-left" size="xs" />
          </button>
          <span class="period-label">{{ periodLabel }}</span>
          <button type="button" class="nav-btn" aria-label="下一段" @click="goNext">
            <AppIcon name="chevron-right" size="xs" />
          </button>
        </div>
        <button type="button" class="today-btn" @click="goToday">今日</button>
      </div>
    </header>

    <Teleport to="body">
      <p
        v-if="previewHint && hintStyle"
        class="calendar-drag-hint"
        :style="hintStyle"
      >
        {{ previewHint }}
      </p>
    </Teleport>

    <div class="board" :class="mode">
      <div v-if="isOverview" class="overview-grid">
        <CalendarMonthCard
          v-for="item in overviewMonths"
          :key="`${item.year}-${item.month}`"
          :year="item.year"
          :month="item.month"
          :today="today"
          :selected-date="store.selectedDate"
          :task-dates="taskDates"
          @select="selectDay"
          @create="openCreate"
          @open-month="openMonth"
        />
      </div>

      <template v-else>
        <div v-if="mode === 'month'" class="weekday-row">
          <span v-for="day in weekdays" :key="day">{{ day }}</span>
        </div>

        <div
          v-for="(days, weekIndex) in weekRows"
          :key="weekIndex"
          :ref="(el) => setWeekEl(weekIndex, el)"
          class="week"
          :style="mode === 'month' ? { minHeight: `${weekMinHeight(weekIndex)}px` } : undefined"
        >
          <div class="week-days">
            <div
              v-for="date in days"
              :key="formatDate(date)"
              class="day-cell"
              :data-date="formatDate(date)"
              :class="{
                today: formatDate(date) === today,
                selected: formatDate(date) === store.selectedDate,
                outside: mode === 'month' && isOutsideMonth(date),
              }"
              @click="selectDay(date)"
              @dblclick="openCreate(date)"
            >
              <div class="day-head">
                <div class="day-label">
                  <span v-if="mode === 'week'" class="day-weekday">{{ weekdays[date.getDay()] }}</span>
                  <span class="day-num">{{ date.getDate() }}</span>
                  <span
                    v-if="mode === 'week' && shouldShowWeekMonth(date, days)"
                    class="day-month"
                  >
                    {{ date.getMonth() + 1 }}月
                  </span>
                </div>
                <button
                  type="button"
                  class="add-day"
                  :aria-label="`在 ${formatDate(date)} 新增任務`"
                  @click.stop="openCreate(date)"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div
            class="week-lanes"
            :style="{
              gridTemplateRows: `repeat(${layouts[weekIndex].laneCount}, ${laneRowSize}px)`,
            }"
          >
            <CalendarTaskBlock
              v-for="segment in layouts[weekIndex].segments"
              v-show="displayedTask(segment.taskId)"
              :key="segment.taskId + '-' + segment.startCol"
              :style="{
                gridColumn: `${segment.startCol + 1} / span ${segment.span}`,
                gridRow: segment.lane + 1,
              }"
              :task="displayedTask(segment.taskId)!"
              :color="taskColors(displayedTask(segment.taskId)!).color"
              :bg-color="taskColors(displayedTask(segment.taskId)!).bgColor"
              :continues-before="segment.continuesBefore"
              :continues-after="segment.continuesAfter"
              :dragging="draggingTaskId === segment.taskId"
              :drag-mode="draggingTaskId === segment.taskId ? dragMode : null"
              @move-start="beginDrag($event, segment.taskId, 'move')"
              @resize-start="beginDrag($event, segment.taskId, 'resize-start')"
              @resize-end="beginDrag($event, segment.taskId, 'resize-end')"
              @select="onSelectTask(segment.taskId)"
            />
          </div>
        </div>
      </template>
    </div>

    <TaskFormModal
      :visible="showCreateModal"
      mode="create"
      :default-date="createDate"
      @close="showCreateModal = false"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.calendar-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;

  &.week-mode,
  &.overview-mode {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  &.dragging {
    cursor: grabbing;
  }

  &.resizing {
    cursor: ew-resize;
  }
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  flex-shrink: 0;

  h1 {
    font-size: 24px;
    font-weight: 700;
  }
}

.subtitle {
  color: $text-muted;
  font-size: 13px;
  margin-top: 4px;
  max-width: 560px;
}

.header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.mode-toggle {
  display: flex;
  background: $surface;
  border: 1px solid $border;
  border-radius: 999px;
  padding: 3px;

  button {
    min-width: 40px;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    color: $text-muted;

    &.active {
      background: $primary-light;
      color: $primary;
    }
  }
}

.period-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: $text-muted;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: $primary-light;
    color: $primary;
  }
}

.period-label {
  min-width: 220px;
  text-align: center;
  font-weight: 700;
  font-size: 15px;
}

.today-btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid $border;
  background: $surface;
  font-weight: 600;
  color: $text;

  &:hover {
    border-color: $primary;
    color: $primary;
  }
}

.board {
  position: relative;
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: 1px solid $border;
  background: $bg;

  span {
    padding: 10px 8px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: $text-muted;
  }
}

.week {
  position: relative;
  min-height: 112px;
  border-bottom: 1px solid $border;

  &:last-child {
    border-bottom: none;
  }
}

.week-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  min-height: inherit;
  height: 100%;
}

.board.week {
  overflow-x: auto;
  overflow-y: hidden;
}

.board.quarter,
.board.year {
  overflow: auto;
}

.overview-grid {
  display: grid;
  gap: 8px 12px;
  padding: 12px 16px 16px;
  flex: 1;
  min-height: 0;
  align-content: start;
}

.board.quarter .overview-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.board.year .overview-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 1100px) {
  .board.year .overview-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.board.week .week {
  flex: 1;
  min-height: 280px;
  display: flex;
  flex-direction: column;
}

.board.week .week-days {
  flex: 1;
  min-height: 0;
}

.day-cell {
  min-width: 0;
  padding: 6px 6px 28px;
  border-right: 1px solid $border;
  cursor: pointer;

  &:nth-child(7n) {
    border-right: none;
  }

  &.outside {
    background: #fafafa;

    .day-num {
      color: $text-muted;
      opacity: 0.55;
    }
  }

  &.today .day-num {
    background: $primary;
    color: white;
  }

  &.selected:not(.today) .day-num {
    background: $primary-light;
    color: $primary;
  }

  &:hover .add-day {
    opacity: 1;
  }
}

.board.week .day-cell {
  padding: 8px 8px 12px;
  min-width: 80px;

  &.today {
    background: color-mix(in srgb, $primary 6%, $surface);
  }

  &.selected:not(.today) {
    background: color-mix(in srgb, $primary 4%, $surface);
  }
}

.day-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 4px;
}

.day-label {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 6px;
  min-width: 0;
}

.day-weekday {
  width: 100%;
  font-size: 12px;
  font-weight: 600;
  color: $text-muted;
  line-height: 1.2;
}

.day-month {
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
}

.day-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.add-day {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  color: $text-muted;
  opacity: 0;
  font-size: 16px;
  line-height: 1;

  &:hover {
    background: $primary-light;
    color: $primary;
  }
}

.week-lanes {
  position: absolute;
  left: 0;
  right: 0;
  top: 32px;
  bottom: 4px;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: 22px;
  gap: 3px 0;
  padding: 0;
  pointer-events: none;
  align-content: start;
  overflow: hidden;

  > * {
    pointer-events: auto;
    min-width: 0;
  }
}

.board.week .week-lanes {
  top: 52px;
  grid-auto-rows: 28px;
  gap: 4px 0;
  overflow-y: auto;
}

@media (max-width: $breakpoint-sm) {
  .page-header {
    margin-bottom: 12px;
  }

  .subtitle {
    display: none;
  }

  .period-label {
    min-width: 120px;
    font-size: 13px;
  }

  .board.year .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .board.quarter .overview-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .week {
    min-height: 88px;
  }

  .board.week .week {
    min-height: min(70vh, 560px);
  }

  .add-day {
    opacity: 1;
  }
}
</style>

<style lang="scss">
@use '@/styles/variables' as *;

.calendar-drag-hint {
  position: fixed;
  z-index: 3000;
  margin: 0;
  padding: 6px 12px;
  max-width: 320px;
  border: 1px solid $border;
  border-radius: 999px;
  background: $surface;
  box-shadow: $shadow-lg;
  color: $primary;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  pointer-events: none;
}
</style>
