export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayString(): string {
  return formatDate(new Date())
}

export function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(dateStr: string, days: number): string {
  const date = parseDateString(dateStr)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

export function isSameDate(a: string, b: string): boolean {
  return a === b
}

export function formatDisplayDate(dateStr: string): string {
  const date = parseDateString(dateStr)
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${date.getMonth() + 1}月${date.getDate()}日 週${weekdays[date.getDay()]}`
}

export function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = []
  const last = new Date(year, month + 1, 0)
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  return days
}

export function getCalendarGrid(year: number, month: number): (Date | null)[] {
  const days = getMonthDays(year, month)
  const firstDay = new Date(year, month, 1).getDay()
  const grid: (Date | null)[] = Array(firstDay).fill(null)
  days.forEach((d) => grid.push(d))
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}
