import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FormattedContentEditor from '@/components/FormattedContentEditor.vue'
import {
  SAMPLE_CODE,
  SAMPLE_MARKDOWN,
  createImagePasteEvent,
  createPasteEvent,
} from './helpers'

function mountEditor(
  props: {
    content?: string
    contentType?: 'text' | 'code' | 'markdown'
    placeholder?: string
    previewUntilEdit?: boolean
    borderless?: boolean
  } = {},
) {
  return mount(FormattedContentEditor, {
    props: {
      content: props.content ?? '',
      contentType: props.contentType ?? 'text',
      placeholder: props.placeholder ?? '輸入備註或目前進度…',
      previewUntilEdit: props.previewUntilEdit,
      borderless: props.borderless,
    },
    attachTo: document.body,
  })
}

function textarea(wrapper: ReturnType<typeof mountEditor>) {
  return wrapper.get('textarea.content-textarea')
}

describe('FormattedContentEditor', () => {
  it('純文字顯示 textarea，可輸入多行', async () => {
    const wrapper = mountEditor({ content: '第一行' })
    const el = textarea(wrapper)
    expect(el.element.value).toBe('第一行')

    await el.setValue('第一行\n第二行')
    expect(el.element.value).toContain('\n')
    wrapper.unmount()
  })

  it('失焦提交內容與偵測到的格式', async () => {
    const wrapper = mountEditor()
    await textarea(wrapper).setValue(SAMPLE_MARKDOWN)
    await textarea(wrapper).trigger('blur')

    const commits = wrapper.emitted('commit')
    expect(commits).toHaveLength(1)
    expect(commits?.[0]).toEqual([SAMPLE_MARKDOWN, 'markdown'])
    wrapper.unmount()
  })

  it('清空後失焦可以提交空字串', async () => {
    const wrapper = mountEditor({ content: '舊內容' })
    await textarea(wrapper).setValue('')
    await textarea(wrapper).trigger('blur')

    expect(wrapper.emitted('commit')?.[0]).toEqual(['', 'text'])
    wrapper.unmount()
  })

  it('內容與格式都沒變則不重複提交', async () => {
    const wrapper = mountEditor({ content: '沒改' })
    await textarea(wrapper).trigger('blur')
    expect(wrapper.emitted('commit')).toBeUndefined()
    wrapper.unmount()
  })

  it('只去掉尾端多餘換行，不把整段 trim 掉', async () => {
    const wrapper = mountEditor()
    await textarea(wrapper).setValue('  保留前空白\n')
    await textarea(wrapper).trigger('blur')

    expect(wrapper.emitted('commit')?.[0]?.[0]).toBe('  保留前空白')
    wrapper.unmount()
  })

  it('markdown 預覽時不顯示 textarea', () => {
    const wrapper = mountEditor({
      content: SAMPLE_MARKDOWN,
      contentType: 'markdown',
    })
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('.markdown-content').exists()).toBe(true)
    wrapper.unmount()
  })

  it('預覽中貼上格式化文字會整段套用', async () => {
    const wrapper = mountEditor({
      content: SAMPLE_MARKDOWN,
      contentType: 'markdown',
    })
    await wrapper.get('.formatted-content-editor').element.dispatchEvent(
      createPasteEvent(SAMPLE_CODE),
    )
    await nextTick()

    expect(wrapper.emitted('commit')?.[0]).toEqual([SAMPLE_CODE, 'code'])
    wrapper.unmount()
  })

  it('編輯中貼上格式化文字用全文判斷，不覆寫成剪貼簿 alone', async () => {
    const wrapper = mountEditor({ content: '前言' })
    const el = textarea(wrapper).element
    const combined = `前言\n${SAMPLE_MARKDOWN}`
    el.value = combined
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(createPasteEvent(SAMPLE_MARKDOWN))
    await nextTick()
    await nextTick()

    expect(wrapper.emitted('commit')?.[0]).toEqual([combined, 'markdown'])
    wrapper.unmount()
  })

  it('編輯中貼上純文字不立刻提交，等失焦', async () => {
    const wrapper = mountEditor({ content: '原稿' })
    const el = textarea(wrapper).element
    el.value = '原稿補一句'
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(createPasteEvent('補一句'))
    await nextTick()

    expect(wrapper.emitted('commit')).toBeUndefined()
    wrapper.unmount()
  })

  it('貼上圖片交給外層，不寫入文字', async () => {
    const wrapper = mountEditor()
    const file = new File(['png'], 'shot.png', { type: 'image/png' })
    await textarea(wrapper).element.dispatchEvent(createImagePasteEvent(file))
    await nextTick()

    expect(wrapper.emitted('paste-image')?.[0]?.[0]).toBe(file)
    expect(wrapper.emitted('commit')).toBeUndefined()
    wrapper.unmount()
  })

  it('previewUntilEdit 時純文字先顯示預覽，沒有灰框 textarea', () => {
    const wrapper = mountEditor({
      content: '展開後的備註',
      previewUntilEdit: true,
      borderless: true,
    })
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.classes()).not.toContain('is-editing')
    expect(wrapper.get('.text-preview').text()).toBe('展開後的備註')
    expect(wrapper.classes()).toContain('borderless')
    wrapper.unmount()
  })

  it('previewUntilEdit 時點兩下進入編輯', async () => {
    const wrapper = mountEditor({
      content: '展開後的備註',
      previewUntilEdit: true,
    })
    await wrapper.get('.formatted-content-editor').trigger('dblclick')
    await nextTick()
    expect(textarea(wrapper).element.value).toBe('展開後的備註')
    expect(document.activeElement).toBe(textarea(wrapper).element)
    expect(wrapper.classes()).toContain('is-editing')
    expect(wrapper.attributes('title')).toBe('編輯中')
    wrapper.unmount()
  })

  it('轉為一般文字只發事件，不改內容', async () => {
    const wrapper = mountEditor({
      content: SAMPLE_MARKDOWN,
      contentType: 'markdown',
    })
    await wrapper.get('button[title="轉為一般文字"]').trigger('click')
    expect(wrapper.emitted('convert-to-text')).toHaveLength(1)
    expect(wrapper.emitted('commit')).toBeUndefined()
    wrapper.unmount()
  })
})
