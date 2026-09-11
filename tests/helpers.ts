export function createPasteEvent(text: string): ClipboardEvent {
  const clipboardData = new DataTransfer()
  clipboardData.setData('text/plain', text)
  return new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData,
  })
}

export function createImagePasteEvent(file?: File): ClipboardEvent {
  const clipboardData = new DataTransfer()
  clipboardData.items.add(file ?? new File(['png'], 'shot.png', { type: 'image/png' }))
  return new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData,
  })
}

export const SAMPLE_MARKDOWN = `# 進度\n\n- 已完成登入\n- 待補測試`

export const SAMPLE_CODE = [
  'function greet(name) {',
  '  const message = `hi ${name}`',
  '  return message',
  '}',
].join('\n')
