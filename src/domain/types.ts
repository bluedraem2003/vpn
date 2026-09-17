/** Shared domain model for Content Ops platform (AI-ready metadata included). */

export type Platform = 'instagram' | 'telegram' | 'youtube' | 'tiktok' | 'linkedin'

export type ContentType =
  | 'reel'
  | 'post'
  | 'carousel'
  | 'story'
  | 'video'
  | 'photo'
  | 'article'
  | 'youtube_video'
  | 'short'
  | 'other'

export type ContentStatus =
  | 'idea'
  | 'planned'
  | 'in_production'
  | 'in_review'
  | 'revision'
  | 'ready'
  | 'scheduled'
  | 'published'
  | 'archived'

export type AssetType = 'image' | 'video' | 'audio' | 'document' | 'pdf' | 'archive' | 'other'

export type AssetStatus = 'raw' | 'editing' | 'ready' | 'attached' | 'published' | 'archived'

export type VirtualFolder =
  | 'raw'
  | 'editing'
  | 'final'
  | 'covers'
  | 'published'
  | 'archive'
  | 'clients'
  | 'projects'

export type MemberRole = 'admin' | 'manager' | 'editor' | 'designer' | 'copywriter' | 'viewer'

export type IdeaPriority = 'low' | 'medium' | 'high'

export interface User {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  createdAt: string
}

export interface Membership {
  id: string
  workspaceId: string
  userId: string
  role: MemberRole
}

export interface Project {
  id: string
  workspaceId: string
  name: string
  clientName?: string
  description?: string
  createdAt: string
}

export interface Campaign {
  id: string
  workspaceId: string
  projectId?: string
  name: string
  goal?: string
  status: 'draft' | 'active' | 'completed' | 'archived'
  platforms: Platform[]
  startDate?: string
  endDate?: string
  createdAt: string
}

export interface Tag {
  id: string
  workspaceId: string
  name: string
}

export interface ContentItem {
  id: string
  workspaceId: string
  projectId?: string
  campaignId?: string
  assigneeId?: string
  title: string
  description?: string
  platforms: Platform[]
  contentType: ContentType
  status: ContentStatus
  publishDate?: string
  publishTime?: string
  caption?: string
  hashtags: string[]
  notes?: string
  /** Structured bag for future AI features — do not use for secrets */
  aiMeta?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ContentStatusHistory {
  id: string
  contentId: string
  fromStatus?: ContentStatus
  toStatus: ContentStatus
  changedBy?: string
  note?: string
  createdAt: string
}

export interface TelegramSource {
  id: string
  assetId: string
  telegramFileId: string
  telegramFileUniqueId: string
  telegramMessageId: number
  telegramChatId: string
  filename?: string
  mimeType?: string
  fileSize?: number
  width?: number
  height?: number
  duration?: number
  caption?: string
  thumbnailFileId?: string
  createdAt: string
  updatedAt: string
}

export interface Asset {
  id: string
  workspaceId: string
  type: AssetType
  status: AssetStatus
  virtualFolder: VirtualFolder
  filename: string
  mimeType?: string
  fileSize?: number
  width?: number
  height?: number
  duration?: number
  storageProvider: 'telegram' | 's3' | 'r2' | 'local'
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface ContentAsset {
  id: string
  contentId: string
  assetId: string
  role?: 'primary' | 'cover' | 'thumbnail' | 'audio' | 'other'
  sortOrder: number
}

export interface Idea {
  id: string
  workspaceId: string
  title: string
  description?: string
  reference?: string
  platforms: Platform[]
  contentType?: ContentType
  priority: IdeaPriority
  tags: string[]
  notes?: string
  convertedContentId?: string
  createdAt: string
}

export const CONTENT_STATUS_FLOW: ContentStatus[] = [
  'idea',
  'planned',
  'in_production',
  'in_review',
  'revision',
  'ready',
  'scheduled',
  'published',
  'archived',
]

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'اینستاگرام',
  telegram: 'تلگرام',
  youtube: 'یوتیوب',
  tiktok: 'تیک‌تاک',
  linkedin: 'لینکدین',
}

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  idea: 'ایده',
  planned: 'برنامه‌ریزی',
  in_production: 'در تولید',
  in_review: 'بازبینی',
  revision: 'اصلاح',
  ready: 'آماده',
  scheduled: 'زمان‌بندی',
  published: 'منتشر شده',
  archived: 'آرشیو',
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  reel: 'ریلز',
  post: 'پست',
  carousel: 'کاروسل',
  story: 'استوری',
  video: 'ویدیو',
  photo: 'عکس',
  article: 'مقاله',
  youtube_video: 'ویدیو یوتیوب',
  short: 'شورت',
  other: 'سایر',
}
