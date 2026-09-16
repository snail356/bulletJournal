import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CommandItemRow from '@/components/CommandItemRow.vue'
import { useCommandStore } from '@/stores/commandStore'
import { createDefaultCommandCategories } from '@/utils/commandCheatsheet'

function mountRow(content = 'git reset --soft HEAD^', note = '想保留修改但取消 commit') {
  return mount(CommandItemRow, {
    props: {
      categoryId: 'cat-1',
      item: {
        id: 'item-1',
        content,
        note,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
    global: {
      stubs: {
        AppIcon: true,
        DeleteIconButton: true,
        PopoverIconButton: true,
      },
    },
  })
}

describe('CommandItemRow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useCommandStore()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('點選指令會複製到剪貼簿', async () => {
    const wrapper = mountRow()
    await wrapper.get('.command-text').trigger('click')
    await nextTick()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('git reset --soft HEAD^')
  })

  it('點選複製圖示會複製到剪貼簿', async () => {
    const wrapper = mountRow()
    await wrapper.get('.copy-btn').trigger('click')
    await nextTick()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('git reset --soft HEAD^')
  })

  it('離開輸入區會儲存指令與說明', async () => {
    const store = useCommandStore()
    store.createCategory('測試')
    const category = store.categories[0]
    const item = store.createItem(category.id)
    expect(item).toBeTruthy()

    const wrapper = mount(CommandItemRow, {
      props: {
        categoryId: category.id,
        item: item!,
        autofocus: true,
      },
      global: {
        stubs: {
          AppIcon: true,
          DeleteIconButton: true,
          PopoverIconButton: true,
        },
      },
    })
    await nextTick()

    await wrapper.get('.command-input').setValue('git status')
    await wrapper.get('.edit-input:not(.command-input)').setValue('查看狀態')
    await wrapper.get('form.edit-form').trigger('focusout', { relatedTarget: null })
    await nextTick()

    expect(store.categories[0].items[0].content).toBe('git status')
    expect(store.categories[0].items[0].note).toBe('查看狀態')
  })
})

describe('createDefaultCommandCategories', () => {
  it('預設類別可被 store 顯示', () => {
    setActivePinia(createPinia())
    const store = useCommandStore()
    store.categories = createDefaultCommandCategories()
    expect(store.categoriesSorted.map((category) => category.title)).toEqual([
      'git 指令',
      'DeskIn 帳密',
    ])
  })

  it('reorderItems 會調整同一類別內的指令順序', () => {
    setActivePinia(createPinia())
    const store = useCommandStore()
    const [git] = createDefaultCommandCategories()
    store.categories = [git]
    const [first, second] = git.items
    store.reorderItems(git.id, second.id, first.id)
    expect(store.categories[0].items.map((item) => item.content)).toEqual([
      'git merge --no-commit --no-ff <分支名稱>',
      'git reset --soft HEAD^',
    ])
  })
})
