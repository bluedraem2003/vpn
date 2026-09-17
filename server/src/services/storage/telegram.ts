import type { StorageDownload, StorageObjectMeta, StorageProvider } from './types'

/**
 * Telegram Bot API storage adapter.
 * Never persists temporary Telegram file URLs — always resolve via getFile at request time.
 * Bot API download limit ≈ 20MB unless Local Bot API Server is configured.
 */
export class TelegramStorageProvider implements StorageProvider {
  readonly name = 'telegram'

  constructor(
    private readonly token: string,
    private readonly apiBase = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org',
  ) {}

  private api(method: string) {
    return `${this.apiBase}/bot${this.token}/${method}`
  }

  private fileUrl(filePath: string) {
    return `${this.apiBase}/file/bot${this.token}/${filePath}`
  }

  async getMetadata(fileId: string): Promise<StorageObjectMeta> {
    const res = await fetch(this.api('getFile'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    })
    const data = (await res.json()) as {
      ok: boolean
      result?: { file_id: string; file_path?: string; file_size?: number }
      description?: string
    }
    if (!data.ok || !data.result) {
      throw new Error(data.description || 'Telegram getFile failed')
    }
    const path = data.result.file_path || ''
    return {
      id: fileId,
      filename: path.split('/').pop() || fileId,
      size: data.result.file_size,
    }
  }

  async download(fileId: string): Promise<StorageDownload> {
    const meta = await this.getMetadata(fileId)
    const res = await fetch(this.api('getFile'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    })
    const data = (await res.json()) as {
      ok: boolean
      result?: { file_path?: string; file_size?: number }
      description?: string
    }
    if (!data.ok || !data.result?.file_path) {
      throw new Error(data.description || 'Telegram file path unavailable')
    }
    const fileRes = await fetch(this.fileUrl(data.result.file_path))
    if (!fileRes.ok) throw new Error('Telegram download failed')
    const buffer = Buffer.from(await fileRes.arrayBuffer())
    return {
      stream: buffer,
      filename: meta.filename,
      mimeType: fileRes.headers.get('content-type') || undefined,
      size: data.result.file_size,
    }
  }

  async getPreview(fileId: string): Promise<StorageDownload | null> {
    try {
      return await this.download(fileId)
    } catch {
      return null
    }
  }

  async delete(_ref: string): Promise<void> {
    // Telegram Bot API does not support deleting arbitrary channel media by file_id.
    // Soft-delete happens in our DB only.
  }
}
