import type { ContentFormat } from '@/types'
import { looksLikeCode } from '@/utils/detectCode'

/** 整段內容是否僅為單一 fenced code block */
function isSingleFencedCodeBlock(text: string): boolean {
  return /^```[\w-]*\r?\n[\s\S]*\r?\n```$/.test(text.trim())
}

/**
 * 啟發式判斷文字是否像 Markdown（門檻偏保守，避免一般中文段落被誤判）。
 */
export function looksLikeMarkdown(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false

  // 整段僅為單一 fenced block → 視為 code，不是 markdown 文件
  if (isSingleFencedCodeBlock(trimmed)) return false

  const patterns = [
    /^#{1,6}\s+\S/m,
    /^[\t ]*[-*+]\s+\S/m,
    /^[\t ]*\d+\.\s+\S/m,
    /\*\*[^*\n]+\*\*/,
    /__[^_\n]+__/,
    /\[[^\]]+\]\([^)]+\)/,
    /^>\s+\S/m,
    /^---+$/m,
    /```[\s\S]*?```/,
  ]

  return patterns.some((re) => re.test(trimmed))
}

export function resolveContentType(text: string): ContentFormat {
  const trimmed = text.trim()
  if (!trimmed) return 'text'
  if (isSingleFencedCodeBlock(trimmed)) return 'code'
  if (looksLikeMarkdown(trimmed)) return 'markdown'
  if (looksLikeCode(trimmed)) return 'code'
  return 'text'
}
