import type { DailyReflection, StatusItem, Task } from '@/types'

const DEFAULT_MODEL = 'gemini-3.5-flash'

export function getGeminiApiKey(): string {
  return (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() ?? ''
}

export function getGeminiModel(): string {
  return (
    (import.meta.env.VITE_GEMINI_MODEL as string | undefined)?.trim() ||
    DEFAULT_MODEL
  )
}

export function hasGeminiApiKey(): boolean {
  return getGeminiApiKey().length > 0
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
      if (task.difficultyNote.trim()) {
        lines.push(`   困難點：${truncate(task.difficultyNote, 120)}`)
      }
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

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  error?: {
    message?: string
    status?: string
  }
}

export async function generateAiManagerAdvice(
  reflection: DailyReflection,
  customPrompt = '',
  dayTasks: Task[] = [],
  statusItems: StatusItem[] = [],
): Promise<string> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error(
      '尚未設定 VITE_GEMINI_API_KEY。請參考 docs/ai-manager-advice.md 完成設定後重啟開發伺服器。',
    )
  }

  const model = getGeminiModel()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: '你是務實、具體、可執行的 AI 主管，回覆一律使用繁體中文。請同時參考當日任務與回顧內容提出建議。',
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: buildPrompt(
                reflection,
                customPrompt,
                dayTasks,
                statusItems,
              ),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.6,
        // maxOutputTokens 包含模型的思考（thinking）tokens，需預留足夠空間
        maxOutputTokens: 4096,
        thinkingConfig: {
          thinkingLevel: 'low',
        },
      },
    }),
  })

  let data: GeminiGenerateResponse
  try {
    data = (await response.json()) as GeminiGenerateResponse
  } catch {
    throw new Error(`Gemini API 回應無法解析（HTTP ${response.status}）`)
  }

  if (!response.ok) {
    const apiMessage = data.error?.message
    if (response.status === 403) {
      throw new Error(apiMessage || 'API Key 無權限或未啟用 Gemini API（HTTP 403）')
    }
    if (response.status === 429) {
      throw new Error(apiMessage || '已達 Gemini API 配額或速率限制（HTTP 429）')
    }
    throw new Error(
      apiMessage || `Gemini API 呼叫失敗（HTTP ${response.status}）`,
    )
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim()

  if (!text) {
    throw new Error('Gemini 未回傳可用的建議內容，請稍後再試')
  }

  return normalizeAiAdviceText(text)
}
