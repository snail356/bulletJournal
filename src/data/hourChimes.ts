import templatesJson from '@/data/hourChimes.json'

export const hourChimeTemplates: string[] = templatesJson as string[]

let lastIndex = -1

export function formatChimeTime(date = new Date()) {
  const hour24 = date.getHours()
  const period = hour24 < 12 ? '上午' : '下午'
  const hour12 = hour24 % 12 || 12
  const hh = String(hour12).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return { period, time: `${hh} : ${mm}` }
}

export function fillHourChime(template: string, date = new Date()) {
  const { period, time } = formatChimeTime(date)
  return template.replaceAll('下午', period).replaceAll('** : **', time)
}

export function pickHourChime(date = new Date()) {
  const total = hourChimeTemplates.length
  if (!total) return fillHourChime('現在時間 ** : **', date)
  let index = Math.floor(Math.random() * total)
  if (total > 1 && index === lastIndex) index = (index + 1) % total
  lastIndex = index
  return fillHourChime(hourChimeTemplates[index], date)
}

export function msUntilNextHour(from = Date.now()) {
  const now = new Date(from)
  const next = new Date(now)
  next.setSeconds(0, 0)
  next.setMinutes(0)
  next.setHours(now.getHours() + 1)
  return Math.max(1000, next.getTime() - from)
}
