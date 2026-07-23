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

export function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = parseDateString(fromDateStr)
  const to = parseDateString(toDateStr)
  const msPerDay = 86_400_000
  return Math.round((to.getTime() - from.getTime()) / msPerDay)
}

/** 最早的原排程日（無遷移紀錄則回傳目前 date） */
export function getOriginalScheduledDate(
  task: { date: string; migrationHistory: { fromDate: string }[] },
): string {
  const history = task.migrationHistory
  if (!history.length) return task.date
  return history.reduce(
    (earliest, record) =>
      record.fromDate < earliest ? record.fromDate : earliest,
    history[0].fromDate,
  )
}

/** 依遷移紀錄計算從最早原排程日到目前排程日的推延天數；無遷移則為 0 */
export function getPostponedDays(
  task: { date: string; migrationHistory: { fromDate: string }[] },
): number {
  const originalDate = getOriginalScheduledDate(task)
  if (originalDate === task.date) return 0
  return Math.max(0, daysBetween(originalDate, task.date))
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
