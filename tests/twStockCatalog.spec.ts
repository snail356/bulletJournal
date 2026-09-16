import { describe, expect, it } from 'vitest'
import {
  mergeStockCatalog,
  parseStockDirectory,
  searchTwStocks,
  stockCatalogQuote,
} from '@/utils/twStock'

describe('parseStockDirectory', () => {
  it('解析上市公司簡稱，即使沒有行情也能建立清單', () => {
    const rows = parseStockDirectory(
      [{ 公司代號: '2330', 公司簡稱: '台積電', 公司名稱: '台灣積體電路製造股份有限公司' }],
      'twse',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      code: '2330',
      name: '台積電',
      market: 'twse',
      price: null,
      priceText: '—',
    })
  })

  it('解析上櫃英文欄位', () => {
    const rows = parseStockDirectory(
      [
        {
          SecuritiesCompanyCode: '6488',
          CompanyAbbreviation: '環球晶',
          CompanyName: '環球晶圓股份有限公司',
        },
      ],
      'tpex',
    )
    expect(rows[0]).toMatchObject({
      code: '6488',
      name: '環球晶',
      market: 'tpex',
    })
  })
})

describe('mergeStockCatalog', () => {
  it('名冊沒有價格時，後續行情可補上且不覆蓋名稱空白', () => {
    const directory = [stockCatalogQuote('2330', '台積電', 'twse')]
    const quotes = [
      {
        ...stockCatalogQuote('2330', '台積電', 'twse'),
        price: 900,
        priceText: '900.00',
        change: 10,
      },
    ]
    const merged = mergeStockCatalog(directory, quotes)
    expect(merged[0].price).toBe(900)
    expect(merged[0].name).toBe('台積電')
  })

  it('行情為空時保留既有名冊', () => {
    const cached = [stockCatalogQuote('2330', '台積電', 'twse')]
    expect(mergeStockCatalog(cached, [])).toEqual(cached)
  })
})

describe('searchTwStocks', () => {
  it('開盤前沒有成交價也能用代號或名稱搜尋', () => {
    const catalog = [
      stockCatalogQuote('2330', '台積電', 'twse'),
      stockCatalogQuote('2317', '鴻海', 'twse'),
    ]
    expect(searchTwStocks(catalog, '2330').map((item) => item.code)).toEqual([
      '2330',
    ])
    expect(searchTwStocks(catalog, '台積').map((item) => item.code)).toEqual([
      '2330',
    ])
  })
})
