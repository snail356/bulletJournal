export const LABEL_COLORS = [
  '#7c3aed',
  '#3b82f6',
  '#f97316',
  '#22c55e',
  '#ef4444',
  '#6b7280',
] as const

export type LabelColor = (typeof LABEL_COLORS)[number]

export const DEFAULT_LABEL_COLOR: LabelColor = LABEL_COLORS[0]

export const LABEL_COLOR_OPTIONS = LABEL_COLORS.map((color) => ({
  value: color,
  color,
}))

export const LABEL_BG: Record<LabelColor, string> = {
  '#7c3aed': 'var(--label-bg-violet)',
  '#3b82f6': 'var(--label-bg-blue)',
  '#f97316': 'var(--label-bg-orange)',
  '#22c55e': 'var(--label-bg-green)',
  '#ef4444': 'var(--label-bg-red)',
  '#6b7280': 'var(--label-bg-gray)',
}

export const LABEL_BG_FALLBACK = 'var(--label-bg-gray)'

export function getLabelBgForColor(color: string): string {
  const match = LABEL_COLORS.find((item) => item === color)
  return match ? LABEL_BG[match] : LABEL_BG_FALLBACK
}
