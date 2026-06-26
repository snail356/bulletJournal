import { generateId } from './id'
import type { Attachment, AttachmentOwnerType } from '@/types'

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function createAttachmentFromFile(
  ownerType: AttachmentOwnerType,
  ownerId: string,
  file: File,
): Promise<Attachment> {
  const dataUrl = await fileToDataUrl(file)
  const now = new Date().toISOString()
  return {
    id: generateId(),
    ownerType,
    ownerId,
    fileName: file.name || `image-${Date.now()}.png`,
    mimeType: file.type || 'image/png',
    url: dataUrl,
    thumbnailUrl: dataUrl,
    createdAt: now,
  }
}

export function createAttachmentFromClipboardItem(
  ownerType: AttachmentOwnerType,
  ownerId: string,
  file: File,
): Promise<Attachment> {
  return createAttachmentFromFile(ownerType, ownerId, file)
}
