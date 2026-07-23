/**
 * 將剪貼簿 HTML 粗轉為 Markdown，盡量保留粗體、斜體、程式碼、清單與換行。
 */
export function htmlToMarkdown(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''

  const doc = new DOMParser().parseFromString(trimmed, 'text/html')
  return serializeNode(doc.body).replace(/\n{3,}/g, '\n\n').trim()
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const children = Array.from(el.childNodes).map(serializeNode).join('')

  switch (tag) {
    case 'strong':
    case 'b':
      return children.trim() ? `**${children.trim()}**` : ''
    case 'em':
    case 'i':
      return children.trim() ? `*${children.trim()}*` : ''
    case 'code':
      if (el.parentElement?.tagName.toLowerCase() === 'pre') return children
      return children ? `\`${children}\`` : ''
    case 'pre': {
      const code = el.querySelector('code')
      const text = (code?.textContent ?? el.textContent ?? '').replace(/\n$/, '')
      return text ? `\n\`\`\`\n${text}\n\`\`\`\n` : ''
    }
    case 'br':
      return '\n'
    case 'p':
    case 'div':
      return children ? `${children.trim()}\n\n` : '\n'
    case 'li':
      return `- ${children.trim()}\n`
    case 'ul':
    case 'ol':
      return `\n${children}\n`
    case 'h1':
      return children.trim() ? `# ${children.trim()}\n\n` : ''
    case 'h2':
      return children.trim() ? `## ${children.trim()}\n\n` : ''
    case 'h3':
      return children.trim() ? `### ${children.trim()}\n\n` : ''
    case 'blockquote':
      return children
        .trim()
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n') + '\n\n'
    case 'a': {
      const href = el.getAttribute('href')
      if (!href || !children.trim()) return children
      return `[${children.trim()}](${href})`
    }
    default:
      return children
  }
}

/** 從 ClipboardEvent 取出可貼上的文字，優先保留 HTML 樣式轉成 Markdown */
export function getClipboardMarkdown(e: ClipboardEvent): string {
  const html = e.clipboardData?.getData('text/html') ?? ''
  const plain = e.clipboardData?.getData('text/plain') ?? ''
  if (html.trim() && /<(strong|b|em|i|code|pre|h[1-6]|ul|ol|li|a)\b/i.test(html)) {
    const converted = htmlToMarkdown(html)
    if (converted.trim()) return converted
  }
  return plain
}
