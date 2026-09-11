import { describe, expect, it } from 'vitest'
import { looksLikeMarkdown, resolveContentType } from '@/utils/detectContentType'
import { SAMPLE_CODE, SAMPLE_MARKDOWN } from './helpers'

describe('resolveContentType', () => {
  it('空白視為純文字', () => {
    expect(resolveContentType('')).toBe('text')
    expect(resolveContentType('   \n')).toBe('text')
  })

  it('一般中文段落不誤判', () => {
    expect(resolveContentType('今天把備註輸入改成 textarea，手感正常。')).toBe(
      'text',
    )
  })

  it('標題／清單／粗體判為 markdown', () => {
    expect(resolveContentType(SAMPLE_MARKDOWN)).toBe('markdown')
    expect(resolveContentType('**完成** 這項')).toBe('markdown')
    expect(looksLikeMarkdown(SAMPLE_MARKDOWN)).toBe(true)
  })

  it('整段單一 fenced block 判為 code 而非 markdown', () => {
    const fenced = '```ts\nconst a = 1\n```'
    expect(resolveContentType(fenced)).toBe('code')
    expect(looksLikeMarkdown(fenced)).toBe(false)
  })

  it('內含程式碼區塊的文件仍是 markdown', () => {
    expect(resolveContentType('# 說明\n\n```js\nconst a = 1\n```')).toBe(
      'markdown',
    )
  })

  it('多行函式判為 code', () => {
    expect(resolveContentType(SAMPLE_CODE)).toBe('code')
  })
})
