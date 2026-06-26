<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  completed: number
  total: number
  percentage: number
}>()

const circumference = 2 * Math.PI * 42

const offset = computed(
  () => circumference - (props.percentage / 100) * circumference,
)
</script>

<template>
  <div class="progress-ring">
    <p class="label">今日進度</p>
    <div class="ring-wrap">
      <svg viewBox="0 0 100 100" class="ring" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="#e5e7eb"
          stroke-width="8"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="#7c3aed"
          stroke-width="8"
          stroke-linecap="round"
          :stroke-dasharray="`${circumference} ${circumference}`"
          :stroke-dashoffset="offset"
          class="fg"
        />
      </svg>
      <div class="center">
        <span class="pct">{{ percentage }}%</span>
        <span class="count">{{ completed }}/{{ total }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.progress-ring {
  background: $bg;
  border-radius: $radius;
  padding: 16px;
  text-align: center;
  flex-shrink: 0;
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: $text-muted;
  margin-bottom: 12px;
}

.ring-wrap {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto;
}

.ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.fg {
  transition: stroke-dashoffset 0.4s ease;
}

.center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.pct {
  font-size: 22px;
  font-weight: 700;
  color: $primary;
  line-height: 1.2;
}

.count {
  font-size: 11px;
  color: $text-muted;
  margin-top: 2px;
}
</style>
