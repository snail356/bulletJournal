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
  '#7c3aed': '#ede9fe',
  '#3b82f6': '#dbeafe',
  '#f97316': '#ffedd5',
  '#22c55e': '#dcfce7',
  '#ef4444': '#fee2e2',
  '#6b7280': '#f3f4f6',
}

export function getLabelBgForColor(color: string): string {
  const match = LABEL_COLORS.find((item) => item === color)
  return match ? LABEL_BG[match] : '#f3f4f6'
}
