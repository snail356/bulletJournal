import type { DailyReflection, StatusItem, Task } from '@/types'
import {
  buildSphereConversation,
  type SphereAiTurn,
} from '@/utils/sphereAi'

export interface GeminiServerStatus {
  configured: boolean
  model: string
}

const FALLBACK_STATUS: GeminiServerStatus = {
  configured: false,
  model: 'gemini-3.5-flash',
}

let statusRequest: Promise<GeminiServerStatus> | null = null

/** 只問伺服器是否已設定 Key 與模型名稱，不取得 Key */
export function loadGeminiServerStatus(): Promise<GeminiServerStatus> {
  statusRequest ??= fetch('/api/gemini')
    .then(async (response) => {
      if (!response.ok) return FALLBACK_STATUS
      const data = (await response.json()) as Partial<GeminiServerStatus>
      return {
        configured: data.configured === true,
        model:
          typeof data.model === 'string' && data.model.trim()
            ? data.model.trim()
            : FALLBACK_STATUS.model,
      }
    })
    .catch(() => FALLBACK_STATUS)
  return statusRequest
}

/** 清掉 API 回傳或舊資料中多餘空白，避免 Markdown 渲染後版面鬆散 */
export function normalizeAiAdviceText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/^[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function truncate(text: string, max = 280): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed
}

function formatDayTasks(tasks: Task[], statusItems: StatusItem[]): string {
  if (!tasks.length) return '（當日無任務）'

  return tasks
    .map((task, index) => {
      const statusName =
        statusItems.find((item) => item.id === task.status)?.name ?? task.status
      const doneSub = task.subtasks.filter((s) => s.completed).length
      const totalSub = task.subtasks.length
      const lines = [
        `${index + 1}. [${task.completed ? '已完成' : '未完成'}] ${task.title || '（無標題）'}`,
        `   狀態：${statusName}` +
          (task.statusHours != null ? `｜時數：${task.statusHours}h` : ''),
      ]
      if (task.bodyContent.trim()) {
        lines.push(`   內容：${truncate(task.bodyContent)}`)
      }
      if (totalSub > 0) {
        lines.push(`   子任務：${doneSub}/${totalSub} 完成`)
        for (const sub of task.subtasks.slice(0, 8)) {
          lines.push(
            `   - [${sub.completed ? 'x' : ' '}] ${sub.title || '（無標題）'}` +
              (sub.note.trim() ? `（${truncate(sub.note, 80)}）` : ''),
          )
        }
        if (task.subtasks.length > 8) {
          lines.push(`   - …另有 ${task.subtasks.length - 8} 項子任務`)
        }
      }
      return lines.join('\n')
    })
    .join('\n\n')
}

function buildPrompt(
  reflection: DailyReflection,
  customPrompt: string,
  dayTasks: Task[],
  statusItems: StatusItem[],
): string {
  const section = (label: string, text: string) =>
    `【${label}】\n${text.trim() || '（未填寫）'}`

  return [
    ...(customPrompt.trim()
      ? ['【使用者自訂 Prompt】', customPrompt.trim(), '']
      : []),
    '你是一位務實、具體、可執行的 AI 主管，正在檢視同仁的「每日回顧」與「當日任務」。',
    '請用繁體中文回覆，語氣專業但不指責，著重可落地的下一步。',
    '請同時參考當日任務進度／阻塞與回顧內容，避免只重述日誌文字。',
    '',
    '請使用 Markdown 格式，依下列結構輸出；不要使用程式碼區塊：',
    '## 一、總評',
    '（2～4 句總結當日狀態與節奏）',
    '',
    '## 二、行動建議',
    '1. …',
    '2. …',
    '3. …（可到 4 條）',
    '',
    '以下是該日任務清單：',
    formatDayTasks(dayTasks, statusItems),
    '',
    '以下是該日回顧內容：',
    section('早上', reflection.morningContent),
    '',
    section('下午1點-3點', reflection.afternoon1to3Content),
    '',
    section('下午3點後', reflection.afternoonAfter3Content),
    '',
    section('當日總結', reflection.summaryContent),
  ].join('\n')
}

async function generateGeminiText(options: {
  systemInstruction: string
  userText?: string
  contents?: Array<{ role: 'user' | 'model'; text: string }>
  temperature: number
}): Promise<string> {
  const contents = options.contents ?? [
    { role: 'user' as const, text: options.userText ?? '' },
  ]
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: options.systemInstruction,
      contents,
      temperature: options.temperature,
    }),
  })

  let data: { text?: string; error?: string } | null = null
  try {
    data = (await response.json()) as { text?: string; error?: string }
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new Error(data?.error || `Gemini 呼叫失敗（HTTP ${response.status}）`)
  }

  const text = data?.text?.trim() ?? ''
  if (!text) {
    throw new Error(data?.error || 'Gemini 未回傳可用的建議內容，請稍後再試')
  }

  return normalizeAiAdviceText(text)
}

export async function generateAiManagerAdvice(
  reflection: DailyReflection,
  customPrompt = '',
  dayTasks: Task[] = [],
  statusItems: StatusItem[] = [],
): Promise<string> {
  return generateGeminiText({
    systemInstruction:
      '你是務實、具體、可執行的 AI 主管，回覆一律使用繁體中文。請同時參考當日任務與回顧內容提出建議。',
    userText: buildPrompt(reflection, customPrompt, dayTasks, statusItems),
    temperature: 0.6,
  })
}

/** 依最新筆記本摘要與最近幾輪問答回答；不套用回顧日誌的固定總評格式 */
export async function askJournalQuestion(
  question: string,
  context: string,
  history: SphereAiTurn[] = [],
): Promise<string> {
  const trimmed = question.trim()
  if (!trimmed) {
    throw new Error('請先輸入問題')
  }

  return generateGeminiText({
    systemInstruction: [
      '你是這本子彈筆記的助理。',
      '只根據最新一則訊息裡的筆記本資料與先前對話回答，不要捏造資料裡沒有的任務。',
      '若先前對話與最新筆記本資料衝突，以最新筆記本資料為準。',
      '回覆使用繁體中文與 Markdown，簡潔並可執行。',
      '若問題超出提供的資料，直接說明缺少什麼。',
    ].join(''),
    contents: buildSphereConversation(trimmed, context, history),
    temperature: 0.4,
  })
}
