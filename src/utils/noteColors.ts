import type { Note } from '@/types'

export const NOTE_COLOR_BG: Record<Note['color'], string> = {
  purple: '#ede9fe',
  orange: '#ffedd5',
  green: '#dcfce7',
  blue: '#dbeafe',
  gray: '#f3f4f6',
}

export const NOTE_COLOR_DOT: Record<Note['color'], string> = {
  purple: '#c4b5fd',
  orange: '#fdba74',
  green: '#86efac',
  blue: '#93c5fd',
  gray: '#d1d5db',
}

export const NOTE_COLOR_OPTIONS = (Object.keys(NOTE_COLOR_DOT) as Note['color'][]).map(
  (value) => ({
    value,
    color: NOTE_COLOR_DOT[value],
  }),
)
