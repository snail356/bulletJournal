<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DailyReflection, DailyReflectionInput } from '@/types'
import { formatDisplayDate } from '@/utils/date'

const props = defineProps<{
  visible: boolean
  date: string
  mode: 'prompt' | 'manual'
  existing?: DailyReflection | null
}>()

const emit = defineEmits<{
  submit: [input: DailyReflectionInput]
  save: [input: DailyReflectionInput]
  cancel: [input: DailyReflectionInput]
}>()

const morningContent = ref('')
const afternoon1to3Content = ref('')
const afternoonAfter3Content = ref('')
const summaryContent = ref('')

const title = computed(() =>
  props.mode === 'prompt' ? '每日回顧' : '今日日誌',
)

const subtitle = computed(() => {
  const dateLabel = formatDisplayDate(props.date)
  if (props.mode === 'prompt') {
    return props.existing?.status === 'draft'
      ? `${dateLabel} · 接續昨日未完成提交的草稿`
      : `${dateLabel} · 記錄前一天各時段與當日總結`
  }
  if (props.existing?.status === 'draft') {
    return `${dateLabel} · 編輯暫存日誌`
  }
  return props.existing
    ? `${dateLabel} · 編輯今日日誌`
    : `${dateLabel} · 填寫各時段與當日總結`
})

const showDraftSave = computed(() => props.mode === 'manual')

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    morningContent.value = props.existing?.morningContent ?? ''
    afternoon1to3Content.value = props.existing?.afternoon1to3Content ?? ''
    afternoonAfter3Content.value = props.existing?.afternoonAfter3Content ?? ''
    summaryContent.value = props.existing?.summaryContent ?? ''
  },
)

function payload(): DailyReflectionInput {
  return {
    morningContent: morningContent.value,
    afternoon1to3Content: afternoon1to3Content.value,
    afternoonAfter3Content: afternoonAfter3Content.value,
    summaryContent: summaryContent.value,
  }
}

function saveDraft() {
  emit('save', payload())
}

function submit() {
  emit('submit', payload())
}

function cancel() {
  emit('cancel', payload())
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay" @click.self="cancel">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="reflection-title">
        <header class="header">
          <h2 id="reflection-title">{{ title }}</h2>
          <p class="subtitle">{{ subtitle }}</p>
        </header>

        <div class="fields">
          <label class="field">
            <span class="hint">早上</span>
            <textarea
              v-model="morningContent"
              class="textarea"
              rows="3"
              placeholder="早上發生了什麼、情緒與節奏…"
            />
          </label>

          <label class="field">
            <span class="hint">下午1點-3點</span>
            <textarea
              v-model="afternoon1to3Content"
              class="textarea"
              rows="3"
              placeholder="這個時段的工作與狀態…"
            />
          </label>

          <label class="field">
            <span class="hint">下午3點後</span>
            <textarea
              v-model="afternoonAfter3Content"
              class="textarea"
              rows="3"
              placeholder="傍晚之後的收尾與反思…"
            />
          </label>

          <label class="field">
            <span class="hint">當日總結</span>
            <textarea
              v-model="summaryContent"
              class="textarea"
              rows="3"
              placeholder="今天整體收穫、改善點或明日提醒…"
            />
          </label>
        </div>

        <div class="actions">
          <button type="button" class="btn-text" @click="cancel">取消</button>
          <button type="button" class="btn-primary" @click="submit">完成提交</button>
          <button
            v-if="showDraftSave"
            type="button"
            class="btn-secondary"
            @click="saveDraft"
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.overlay {
  position: fixed;
  inset: 0;
  z-index: 1650;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal {
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow-lg;
  width: 100%;
  max-width: 520px;
  max-height: min(85vh, 680px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  padding: 24px 24px 12px;

  h2 {
    font-size: 18px;
    font-weight: 700;
  }
}

.subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: $text-muted;
  line-height: 1.5;
}

.fields {
  flex: 1;
  overflow-y: auto;
  padding: 8px 24px 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hint {
  color: #888888;
  font-size: 0.85rem;
}

.textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $bg;
  color: $text;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  min-height: 72px;

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 3px $primary-light;
    background: $surface;
  }

  &::placeholder {
    color: #9ca3af;
  }
}

.actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 16px 24px 24px;
  border-top: 1px solid $border;
}

.btn-text {
  margin-right: auto;
  padding: 8px 12px;
  font-size: 13px;
  color: $text-muted;
  border-radius: $radius-sm;

  &:hover {
    background: $bg;
    color: $text;
  }
}

.btn-secondary {
  padding: 8px 14px;
  color: $primary;
  border: 1px solid $primary;
  border-radius: $radius-sm;
  font-weight: 600;
  font-size: 13px;

  &:hover {
    background: $primary-light;
  }
}

.btn-primary {
  padding: 8px 18px;
  background: $primary;
  color: white;
  border-radius: $radius-sm;
  font-weight: 600;

  &:hover {
    background: $primary-dark;
  }
}

@media (max-width: $breakpoint-sm) {
  .overlay {
    padding: 12px;
    align-items: flex-end;
  }

  .modal {
    max-height: 92vh;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .fields {
    padding: 8px 16px 4px;
  }

  .actions {
    flex-wrap: wrap;
    padding: 12px 16px 16px;
  }

  .btn-text {
    margin-right: 0;
    flex: 1 1 100%;
    text-align: center;
  }
}
</style>
