import type { Note } from '@/types'

export const NOTE_COLOR_BG: Record<Note['color'], string> = {
  yellow: 'var(--note-yellow-bg)',
  red: 'var(--note-red-bg)',
  purple: 'var(--note-purple-bg)',
  orange: 'var(--note-orange-bg)',
  green: 'var(--note-green-bg)',
  blue: 'var(--note-blue-bg)',
  gray: 'var(--note-gray-bg)',
}

export const NOTE_COLOR_DOT: Record<Note['color'], string> = {
  yellow: 'var(--note-yellow-dot)',
  red: 'var(--note-red-dot)',
  purple: 'var(--note-purple-dot)',
  orange: 'var(--note-orange-dot)',
  green: 'var(--note-green-dot)',
  blue: 'var(--note-blue-dot)',
  gray: 'var(--note-gray-dot)',
}

export const NOTE_COLOR_OPTIONS = (Object.keys(NOTE_COLOR_DOT) as Note['color'][]).map(
  (value) => ({
    value,
    color: NOTE_COLOR_DOT[value],
  }),
)
