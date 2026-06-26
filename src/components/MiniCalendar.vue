<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import { formatDate, getCalendarGrid, todayString } from '@/utils/date'

const store = useTaskStore()
const viewDate = ref(new Date())

const year = computed(() => viewDate.value.getFullYear())
const month = computed(() => viewDate.value.getMonth())
const monthLabel = computed(() => `${year.value} 年 ${month.value + 1} 月`)

const grid = computed(() => getCalendarGrid(year.value, month.value))
const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const today = todayString()

const taskDates = computed(() => {
  const set = new Set<string>()
  store.tasks.forEach((t) => set.add(t.date))
  return set
})

function prevMonth() {
  viewDate.value = new Date(year.value, month.value - 1, 1)
}

function nextMonth() {
  viewDate.value = new Date(year.value, month.value + 1, 1)
}

function selectDay(date: Date) {
  store.setSelectedDate(formatDate(date))
}

function dayClass(date: Date | null) {
  if (!date) return 'empty'
  const ds = formatDate(date)
  return {
    today: ds === today,
    selected: ds === store.selectedDate,
    hasTasks: taskDates.value.has(ds),
  }
}
</script>

<template>
  <div class="mini-calendar">
    <div class="header">
      <button type="button" aria-label="上個月" @click="prevMonth">‹</button>
      <span>{{ monthLabel }}</span>
      <button type="button" aria-label="下個月" @click="nextMonth">›</button>
    </div>
    <div class="weekdays">
      <span v-for="d in weekdays" :key="d">{{ d }}</span>
    </div>
    <div class="days">
      <button
        v-for="(date, i) in grid"
        :key="i"
        type="button"
        class="day"
        :class="dayClass(date)"
        :disabled="!date"
        @click="date && selectDay(date)"
      >
        {{ date?.getDate() ?? '' }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.mini-calendar {
  background: $bg;
  border-radius: $radius;
  padding: 12px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;

  button {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    color: $text-muted;

    &:hover {
      background: $surface;
      color: $primary;
    }
  }
}

.weekdays,
.days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  text-align: center;
}

.weekdays span {
  font-size: 11px;
  color: $text-muted;
  padding: 4px 0;
}

.day {
  aspect-ratio: 1;
  font-size: 12px;
  border-radius: 6px;
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
    bottom: 3px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: $primary;
  }
}
</style>
