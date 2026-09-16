import { describe, expect, it } from 'vitest'
import {
  createDefaultCommandCategories,
  normalizeCommandCategory,
} from '@/utils/commandCheatsheet'

describe('commandCheatsheet', () => {
  it('預設包含 git 指令與 DeskIn 帳密，且指令可複製內容正確', () => {
    const categories = createDefaultCommandCategories()
    const titles = categories.map((category) => category.title)
    expect(titles).toEqual(['git 指令', 'DeskIn 帳密'])

    const git = categories[0]
    expect(git.items.map((item) => item.content)).toEqual([
      'git reset --soft HEAD^',
      'git merge --no-commit --no-ff <分支名稱>',
    ])
    expect(git.items[0].note).toBe('想保留修改但取消 commit')
    expect(git.items[1].note).toBe('merge 但不直接推')

    const deskin = categories[1]
    expect(deskin.items.map((item) => item.content)).toEqual([
      'carol.cheng@newtype.com.tw',
      'New@type1',
    ])
  })

  it('normalize 會補上缺漏的 note 與 items', () => {
    const normalized = normalizeCommandCategory({
      id: 'cat-1',
      title: '測試',
      items: [
        {
          id: 'item-1',
          content: 'echo hi',
          note: undefined as unknown as string,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(normalized.items[0].note).toBe('')
  })
})
