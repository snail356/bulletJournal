/**
 * 啟發式判斷文字是否像程式碼（門檻偏保守，避免一般中文段落被誤判）。
 */
export function looksLikeCode(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false

  const lines = trimmed.split(/\r?\n/)
  const nonEmpty = lines.filter((line) => line.trim().length > 0)
  if (nonEmpty.length < 2) {
    // 單行僅在明確像程式碼時才判定
    return hasStrongCodeSignals(trimmed) && specialCharRatio(trimmed) >= 0.12
  }

  const indented = nonEmpty.filter((line) => /^\s{2,}|\t/.test(line)).length
  const hasIndent = indented >= 1

  if (hasStrongCodeSignals(trimmed)) return true
  if (hasIndent && specialCharRatio(trimmed) >= 0.06) return true
  if (nonEmpty.length >= 3 && specialCharRatio(trimmed) >= 0.1) return true

  return false
}

function hasStrongCodeSignals(text: string): boolean {
  const patterns = [
    /\b(function|const|let|var|import|export|class|def|return|async|await)\b/,
    /=>/,
    /[{};]\s*$/m,
    /^\s*[.#]?[\w-]+\s*\{/m,
    /<\/?[a-zA-Z][^>]*>/,
    /\bSELECT\b.+\bFROM\b/i,
    /:\s*[\w.'"[\]]+\s*[,;)]/,
  ]
  return patterns.some((re) => re.test(text))
}

function specialCharRatio(text: string): number {
  if (!text.length) return 0
  const special = (text.match(/[{}[\]();=<>/\\`'"]/g) ?? []).length
  return special / text.length
}
