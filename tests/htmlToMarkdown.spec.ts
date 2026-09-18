import { describe, expect, it } from 'vitest'
import { getClipboardMarkdown, htmlToMarkdown } from '@/utils/htmlToMarkdown'
import { createHtmlPasteEvent, createPasteEvent } from './helpers'

describe('htmlToMarkdown', () => {
  it('把標題與清單轉成 markdown', () => {
    const md = htmlToMarkdown('<h1>進度</h1><ul><li>已完成登入</li></ul>')
    expect(md).toContain('# 進度')
    expect(md).toContain('- 已完成登入')
  })

  it('保留粗體', () => {
    expect(htmlToMarkdown('<p>請用 <strong>這項</strong> 完成</p>')).toContain(
      '**這項**',
    )
  })
})

describe('getClipboardMarkdown', () => {
  it('有格式 HTML 時優先轉 markdown，不只用去語法的純文字', () => {
    const event = createHtmlPasteEvent(
      '<h1>進度</h1><ul><li>已完成登入</li></ul>',
      '進度\n已完成登入',
    )
    const text = getClipboardMarkdown(event)
    expect(text).toContain('# 進度')
    expect(text).toContain('- 已完成登入')
  })

  it('沒有格式標籤時用 text/plain', () => {
    expect(getClipboardMarkdown(createPasteEvent('普通句子'))).toBe('普通句子')
  })
})
