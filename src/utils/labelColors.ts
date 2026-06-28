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
