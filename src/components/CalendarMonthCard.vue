<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Task } from '@/types'
import { useTaskStore } from '@/stores/taskStore'
import {
  clipLayoutToMonth,
  layoutWeekSegments,
  weekDateStrings,
} from '@/utils/calendarLayout'
import {
  getCalendarTaskColors,
  type CalendarColorBy,
} from '@/utils/calendarColors'
import { formatDate, getFilledCalendarWeeks, getTaskDuration } from '@/utils/date'

interface MonthMarker {
  task: Task
  color: string
  isBall: boolean
  lane: number
  startCol: number
  span: number
  continuesBefore: boolean
  continuesAfter: boolean
}

const props = defineProps<{
  year: number
  month: number
  today: string
  selectedDate: string
  tasks: Task[]
  compact?: boolean
  colorBy?: CalendarColorBy
}>()

const emit = defineEmits<{
  select: [date: Date]
  create: [date: Date]
  openMonth: [year: number, month: number]
  selectTask: [taskId: string]
}>()

const store = useTaskStore()
const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const hovered = ref<{
  title: string
  x: number
  y: number
  place: 'above' | 'below'
} | null>(null)

const monthLabel = computed(() => `${props.month + 1}月`)
const isCurrentMonth = computed(() => {
  const [y, m] = props.today.split('-').map(Number)
  return y === props.year && m - 1 === props.month
})

const weeks = computed(() =>
  getFilledCalendarWeeks(props.year, props.month).filter((days) =>
    days.some((day) => day.getMonth() === props.month),
  ),
)

const weekMarkers = computed(() => {
  const byId = new Map(props.tasks.map((task) => [task.id, task]))
  return weeks.value.map((days) => {
    const layout = clipLayoutToMonth(
      layoutWeekSegments(props.tasks, weekDateStrings(days)),
      days,
      props.month,
    )
    const markers: MonthMarker[] = []
    for (const segment of layout.segments) {
      const task = byId.get(segment.taskId)
      if (!task) continue
      markers.push({
        task,
        color: taskColor(task),
        isBall: getTaskDuration(task) <= 1,
        lane: segment.lane,
        startCol: segment.startCol,
        span: segment.span,
        continuesBefore: segment.continuesBefore,
        continuesAfter: segment.continuesAfter,
      })
    }
    return { laneCount: layout.laneCount, markers }
  })
})

const markerRowSize = computed(() => (props.compact ? 7 : 8))

function isOutside(date: Date) {
  return date.getMonth() !== props.month
}

function dayClass(date: Date) {
  if (isOutside(date)) return 'outside'
  const ds = formatDate(date)
  return {
    today: ds === props.today,
    selected: ds === props.selectedDate,
  }
}

function taskColor(task: Task) {
  return getCalendarTaskColors(
    task,
    props.colorBy ?? 'label',
    store.labels,
    store.getStatusItem,
  ).color
}

function showTip(event: Event, task: Task) {
  const el = event.currentTarget
  if (!(el instanceof HTMLElement)) return
  const rect = el.getBoundingClientRect()
  const place = rect.top > 36 ? 'above' : 'below'
  hovered.value = {
    title: task.title,
    x: rect.left + rect.width / 2,
    y: place === 'above' ? rect.top : rect.bottom,
    place,
  }
}

function hideTip() {
  hovered.value = null
}

function onDayClick(date: Date) {
  if (isOutside(date)) return
  emit('select', date)
}

function onDayDblclick(date: Date) {
  if (isOutside(date)) return
  emit('create', date)
}
</script>

<template>
  <section
    class="month-card"
    :class="{ current: isCurrentMonth, compact }"
  >
    <button
      type="button"
      class="month-title"
      :aria-label="`檢視 ${year} 年 ${month + 1} 月`"
      @click="emit('openMonth', year, month)"
    >
      {{ monthLabel }}
    </button>
    <div class="weekdays">
      <span v-for="day in weekdays" :key="day">{{ day }}</span>
    </div>
    <div class="weeks">
      <div v-for="(days, weekIndex) in weeks" :key="weekIndex" class="week">
        <div class="days-row">
          <button
            v-for="date in days"
            :key="formatDate(date)"
            type="button"
            class="day"
            :class="dayClass(date)"
            :disabled="isOutside(date)"
            :aria-label="isOutside(date) ? undefined : formatDate(date)"
            @click="onDayClick(date)"
            @dblclick="onDayDblclick(date)"
          >
            <span v-if="!isOutside(date)" class="day-num">{{ date.getDate() }}</span>
          </button>
        </div>
        <div
          class="markers-row"
          :style="{
            minHeight: `${Math.max(weekMarkers[weekIndex].laneCount, 1) * markerRowSize}px`,
            gridTemplateRows: weekMarkers[weekIndex].laneCount
              ? `repeat(${weekMarkers[weekIndex].laneCount}, ${markerRowSize}px)`
              : `${markerRowSize}px`,
          }"
        >
          <div
            v-for="marker in weekMarkers[weekIndex].markers"
            :key="`${marker.task.id}-${marker.startCol}`"
            role="button"
            tabindex="0"
            class="marker"
            :class="{
              ball: marker.isBall,
              string: !marker.isBall,
              completed: marker.task.completed,
              'continues-before': marker.continuesBefore,
              'continues-after': marker.continuesAfter,
            }"
            :style="{
              gridColumn: `${marker.startCol + 1} / span ${marker.span}`,
              gridRow: marker.lane + 1,
              '--marker-color': marker.color,
              '--span': marker.span,
            }"
            :aria-label="marker.task.title"
            @mouseenter="showTip($event, marker.task)"
            @mouseleave="hideTip"
            @focus="showTip($event, marker.task)"
            @blur="hideTip"
            @click.stop="emit('selectTask', marker.task.id)"
            @keydown.enter.prevent="emit('selectTask', marker.task.id)"
            @keydown.space.prevent="emit('selectTask', marker.task.id)"
          />
        </div>
      </div>
    </div>

    <Teleport to="body">
      <p
        v-if="hovered"
        class="calendar-marker-tip"
        :class="hovered.place"
        :style="{ left: `${hovered.x}px`, top: `${hovered.y}px` }"
      >
        {{ hovered.title }}
      </p>
    </Teleport>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.month-card {
  min-width: 0;
  padding: 4px 4px 8px;
}

.month-title {
  display: block;
  width: 100%;
  margin-bottom: 4px;
  padding: 2px 4px;
  border-radius: 8px;
  text-align: left;
  font-size: 13px;
  font-weight: 700;
  color: $text;

  &:hover {
    background: $primary-light;
    color: $primary;
  }
}

.month-card.current .month-title {
  color: $primary;
}

.weekdays,
.days-row,
.markers-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.weekdays span {
  padding: 2px 0 4px;
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  color: $text-muted;
}

.week {
  position: relative;
  min-width: 0;
}

.day {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: $text;

  &.outside {
    visibility: hidden;
  }

  &:not(:disabled):not(.selected):hover .day-num {
    background: $primary-light;
    color: $primary;
  }

  &.today .day-num {
    font-weight: 700;
    color: $primary;
  }

  &.selected .day-num {
    width: 24px;
    height: 24px;
    background: $primary;
    color: white;
    font-weight: 600;
  }
}

.day-num {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
}

.markers-row {
  min-height: 8px;
  padding: 0 0 2px;
  align-content: start;
  column-gap: 0;
}

.marker {
  position: relative;
  display: block;
  box-sizing: border-box;
  min-width: 0;
  padding: 0;
  border: none;
  background: var(--marker-color);
  cursor: pointer;

  &::before {
    content: '';
    position: absolute;
    inset: -4px 0;
  }

  &:hover,
  &:focus-visible {
    z-index: 2;
    filter: brightness(0.92);
  }

  &.completed {
    opacity: 0.45;
  }

  &.ball {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    justify-self: center;
    align-self: center;

    &::before {
      inset: -4px;
    }
  }

  &.string {
    --span: 1;
    --cap: 3px;
    justify-self: stretch;
    align-self: center;
    width: auto;
    min-width: 0;
    height: 6px;
    margin: 0;
    border-radius: 0;
  }

  /* 起迄對齊該日色球中心：內縮半格再扣圓帽半徑 */
  &.string:not(.continues-before) {
    margin-left: max(0px, calc(100% / var(--span) * 0.5 - var(--cap)));
    border-top-left-radius: 999px;
    border-bottom-left-radius: 999px;
  }

  &.string:not(.continues-after) {
    margin-right: max(0px, calc(100% / var(--span) * 0.5 - var(--cap)));
    border-top-right-radius: 999px;
    border-bottom-right-radius: 999px;
  }
}

.month-card.compact {
  .month-title {
    font-size: 12px;
  }

  .day {
    height: 22px;
  }

  .day-num {
    width: 18px;
    height: 18px;
    font-size: 10px;
  }

  .marker.ball {
    width: 5px;
    height: 5px;
  }

  .marker.string {
    height: 4px;
    --cap: 2px;
  }

  .day.selected .day-num {
    width: 20px;
    height: 20px;
  }
}
</style>

<style lang="scss">
@use '@/styles/variables' as *;

.calendar-marker-tip {
  position: fixed;
  z-index: 3000;
  margin: 0;
  padding: 4px 8px;
  max-width: 240px;
  border: 1px solid $border;
  border-radius: 8px;
  background: $surface;
  box-shadow: $shadow-lg;
  color: $text;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;

  &.above {
    transform: translate(-50%, calc(-100% - 6px));
  }

  &.below {
    transform: translate(-50%, 6px);
  }
}
</style>
