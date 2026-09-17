export interface StorageObjectMeta {
  id: string
  filename: string
  mimeType?: string
  size?: number
  width?: number
  height?: number
  duration?: number
}

export interface StorageDownload {
  stream: ReadableStream | NodeJS.ReadableStream | Buffer
  filename: string
  mimeType?: string
  size?: number
}

/**
 * Pluggable storage layer.
 * v1: TelegramStorageProvider
 * later: S3 / R2 / Local without rewriting app routes.
 */
export interface StorageProvider {
  readonly name: string
  getMetadata(ref: string): Promise<StorageObjectMeta>
  download(ref: string): Promise<StorageDownload>
  getPreview(ref: string): Promise<StorageDownload | null>
  delete(ref: string): Promise<void>
}
