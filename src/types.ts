export type ContentFormat = 'feed' | 'reel' | 'story' | 'carousel'
export type Tone = 'friendly' | 'pro' | 'witty' | 'inspiring' | 'luxury'
export type Language = 'fa' | 'en' | 'bilingual'

export interface InstagramPage {
  id: string
  name: string
  niche: string
  audience: string
  voice: string
  handle?: string
  windowStart?: string
  windowEnd?: string
  hashtags?: string[]
  createdAt: number
}

export interface GenerateInput {
  topic: string
  format: ContentFormat
  tone: Tone
  language: Language
  goal: string
  includeEmoji: boolean
  includeCta: boolean
  pageId?: string
}

export interface GeneratedContent {
  id: string
  createdAt: number
  input: GenerateInput
  pageName?: string
  hook: string
  caption: string
  hashtags: string[]
  cta: string
  visualIdea: string
  reelScript?: string
  carouselSlides?: string[]
  altCaptions: string[]
}

export type ViewId = 'studio' | 'history'
