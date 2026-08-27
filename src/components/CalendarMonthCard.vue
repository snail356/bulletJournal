<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, getCalendarGrid } from '@/utils/date'

const props = defineProps<{
  year: number
  month: number
  today: string
  selectedDate: string
  taskDates: Set<string>
}>()

const emit = defineEmits<{
  select: [date: Date]
  create: [date: Date]
  openMonth: [year: number, month: number]
}>()

const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const grid = computed(() => getCalendarGrid(props.year, props.month))
const monthLabel = computed(() => `${props.month + 1} 月`)
const isCurrentMonth = computed(() => {
  const [y, m] = props.today.split('-').map(Number)
  return y === props.year && m - 1 === props.month
})

function dayClass(date: Date | null) {
  if (!date) return 'empty'
  const ds = formatDate(date)
  return {
    today: ds === props.today,
    selected: ds === props.selectedDate,
    hasTasks: props.taskDates.has(ds),
  }
}

function onDayClick(date: Date) {
  emit('select', date)
}

function onDayDblclick(date: Date) {
  emit('create', date)
}
</script>

<template>
  <section class="month-card" :class="{ current: isCurrentMonth }">
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
    <div class="days">
      <button
        v-for="(date, index) in grid"
        :key="index"
        type="button"
        class="day"
        :class="dayClass(date)"
        :disabled="!date"
        :aria-label="date ? formatDate(date) : undefined"
        @click="date && onDayClick(date)"
        @dblclick="date && onDayDblclick(date)"
      >
        {{ date?.getDate() ?? '' }}
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.month-card {
  min-width: 0;
  padding: 8px 6px 10px;
  border-radius: $radius-sm;
}

.month-title {
  display: block;
  width: 100%;
  margin-bottom: 6px;
  padding: 4px 6px;
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
.days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  text-align: center;
}

.weekdays span {
  padding: 2px 0;
  font-size: 10px;
  font-weight: 600;
  color: $text-muted;
}

.day {
  aspect-ratio: 1;
  min-width: 0;
  border-radius: 6px;
  font-size: 11px;
  color: $text;
  position: relative;

  &.empty {
    visibility: hidden;
  }

  &:not(:disabled):hover {
    background: $primary-light;
    color: $primary;
  }

  &.today {
    font-weight: 700;
    color: $primary;
  }

  &.selected {
    background: $primary;
    color: white;
    font-weight: 600;
  }

  &.hasTasks:not(.selected)::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: $primary;
  }
}
</style>
