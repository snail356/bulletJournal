import quotesJson from '@/data/quotes.json'

export interface Quote {
  id: number
  author: string
  author_zh: string
  quote: string
  category: string
}

export const quotes: Quote[] = quotesJson as Quote[]

export function pickRandomQuote(excludeId?: number): Quote {
  const pool =
    excludeId == null ? quotes : quotes.filter((item) => item.id !== excludeId)
  const list = pool.length ? pool : quotes
  return list[Math.floor(Math.random() * list.length)]
}
