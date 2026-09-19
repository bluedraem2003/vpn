const API_BASE = import.meta.env.VITE_API_URL || ''

let authToken: string | null =
  typeof localStorage !== 'undefined' ? localStorage.getItem('postyar_session_token') : null

function uiLang() {
  try {
    return localStorage.getItem('postyar_lang') === 'en' ? 'en' : 'fa'
  } catch {
    return 'fa'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  }
  if (init?.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' })
  const ct = res.headers.get('content-type') || ''
  const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : {}
  if (res.status === 401 && authToken && !path.startsWith('/api/auth/')) {
    // Session died server-side: drop it everywhere and let AuthProvider show the login gate.
    authToken = null
    try {
      localStorage.removeItem('postyar_session_token')
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent('postyar:unauthorized'))
  }
  if (!res.ok) {
    const payload = data as { error?: string; code?: string }
    const err = new Error(
      payload.error || (uiLang() === 'en' ? `API error (${res.status})` : `خطای API (${res.status})`),
    ) as Error & { code?: string }
    err.code = payload.code
    throw err
  }
  if (ct && !ct.includes('application/json')) {
    throw new Error(
      uiLang() === 'en'
        ? 'Invalid server response — hard-refresh once (Ctrl+Shift+R)'
        : 'پاسخ نامعتبر از سرور — یک‌بار رفرش اجباری کنید (Ctrl+Shift+R)',
    )
  }
  return data as T
}

export const api = {
  setToken(token: string | null) {
    authToken = token
  },
  getToken() {
    return authToken
  },
  authHeaders(): Record<string, string> {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {}
  },
  health: () => request<{ ok: boolean; telegramConfigured: boolean }>('/api/health'),
  login: (email?: string) =>
    request<{
      token: string
      expiresAt: string
      user: { id: string; email: string; name: string }
      workspaceId: string
      role: string
    }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email }) }),
  me: () =>
    request<{
      user: { id: string; email: string; name: string }
      workspaceId: string
      role: string
    }>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  bootstrap: () =>
    request<{
      authenticated: boolean
      defaultEmail: string
      magicLinkEnabled?: boolean
      allowDevLogin?: boolean
      ownerKeyEnabled?: boolean
      shareInviteLinks?: boolean
      publicUrl?: string | null
    }>('/api/auth/bootstrap'),
  ownerKeyLogin: (email: string, key: string) =>
    request<{
      token: string
      expiresAt: string
      user: { id: string; email: string; name: string }
      workspaceId: string
      role: string
    }>('/api/auth/owner-key', { method: 'POST', body: JSON.stringify({ email, key }) }),
  requestMagicLink: (email: string) =>
    request<{
      ok: boolean
      message: string
      code?: string
      devMagicUrl?: string
      expiresAt?: string
    }>('/api/auth/magic-link', { method: 'POST', body: JSON.stringify({ email }) }),
  consumeMagicLink: (token: string) =>
    request<{
      token: string
      expiresAt: string
      user: { id: string; email: string; name: string }
      workspaceId: string
      role: string
    }>('/api/auth/magic-link/consume', { method: 'POST', body: JSON.stringify({ token }) }),
  analytics: (workspaceId: string) =>
    request<Record<string, unknown>>(`/api/analytics?workspaceId=${workspaceId}`),
  analyticsConnectors: () => request<{ items: AnalyticsConnector[] }>('/api/analytics/connectors'),
  pageAnalytics: (workspaceId: string, handle: string, fresh?: boolean) => {
    const sp = new URLSearchParams({ workspaceId, handle })
    if (fresh) sp.set('fresh', '1')
    return request<PageAnalyticsResponse>(`/api/analytics/page?${sp}`)
  },
  listCollaborations: (workspaceId: string) =>
    request<{ items: CollabDto[] }>(`/api/collaborations?workspaceId=${workspaceId}`),
  saveCollaboration: (body: {
    workspaceId: string
    handle: string
    name?: string
    notes?: string
    snapshot?: Record<string, unknown>
  }) =>
    request<{ item: CollabDto; created: boolean }>('/api/collaborations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCollaboration: (id: string, body: { name?: string; notes?: string }) =>
    request<{ item: CollabDto }>(`/api/collaborations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteCollaboration: (id: string) => request<{ ok: boolean }>(`/api/collaborations/${id}`, { method: 'DELETE' }),
  updateAsset: (id: string, body: { tags?: string[]; status?: string; virtualFolder?: string }) =>
    request<{ item: AssetDto }>(`/api/assets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  inviteMember: (body: { email: string; name?: string; role?: string }) =>
    request<{
      ok: boolean
      member: { id: string; email: string; name: string; role: string }
      invite: { expiresAt: string; inviteUrl?: string }
    }>('/api/team/invite', { method: 'POST', body: JSON.stringify(body) }),
  mintLoginLink: (userId: string) =>
    request<{ ok: boolean; expiresAt: string; inviteUrl?: string }>(`/api/team/${userId}/login-link`, {
      method: 'POST',
    }),
  updateMemberRole: (userId: string, role: string) =>
    request<{ ok: boolean; role: string }>(`/api/team/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  removeMember: (userId: string) => request<{ ok: boolean }>(`/api/team/${userId}`, { method: 'DELETE' }),
  workspaces: () =>
    request<{ items: Array<{ id: string; name: string; slug: string; role?: string }> }>('/api/workspaces'),
  dashboard: (workspaceId: string) => request<Record<string, unknown>>(`/api/workspaces/${workspaceId}/dashboard`),
  listContent: (workspaceId: string, params?: { status?: string; projectId?: string; q?: string; type?: string }) => {
    const sp = new URLSearchParams({ workspaceId })
    if (params?.status) sp.set('status', params.status)
    if (params?.projectId) sp.set('projectId', params.projectId)
    if (params?.q) sp.set('q', params.q)
    if (params?.type) sp.set('type', params.type)
    return request<{ items: ContentDto[] }>(`/api/content?${sp}`)
  },
  createContent: (body: Partial<ContentDto> & { workspaceId: string; title: string; contentType: string }) =>
    request<{ item: ContentDto }>('/api/content', { method: 'POST', body: JSON.stringify(body) }),
  updateContent: (id: string, body: Partial<ContentDto>) =>
    request<{ item: ContentDto }>(`/api/content/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteContent: (id: string) => request<{ ok: boolean }>(`/api/content/${id}`, { method: 'DELETE' }),
  duplicateContent: (id: string, body?: { publishDate?: string; title?: string }) =>
    request<{ item: ContentDto }>(`/api/content/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
  detachAsset: (contentId: string, linkId: string) =>
    request<{ ok: boolean }>(`/api/content/${contentId}/assets/${linkId}`, { method: 'DELETE' }),
  contentAssets: (contentId: string) =>
    request<{ items: Array<AssetDto & { linkId: string; role?: string }> }>(`/api/content/${contentId}/assets`),
  listAssets: (workspaceId: string, params?: { type?: string; q?: string; sort?: string }) => {
    const sp = new URLSearchParams({ workspaceId, ...(params || {}) })
    return request<{ items: AssetDto[] }>(`/api/assets?${sp}`)
  },
  attachAsset: (assetId: string, contentId: string, role?: string) =>
    request<{ ok: boolean; id: string }>(`/api/assets/${assetId}/attach`, {
      method: 'POST',
      body: JSON.stringify({ contentId, role }),
    }),
  telegramStatus: () =>
    request<{
      configured: boolean
      chatIdConfigured: boolean
      webhookSecretConfigured?: boolean
      indexedFiles: number
      bot?: { id: number; username: string | null; name: string | null } | null
      chats?: TelegramChatDto[]
      connectedChats?: number
      limits: Record<string, unknown>
    }>('/api/telegram/status'),
  listProjects: (workspaceId: string) =>
    request<{ items: ProjectDto[] }>(`/api/projects?workspaceId=${workspaceId}`),
  searchInstagramPages: (q: string) =>
    request<{ items: IgPageHit[] }>(`/api/instagram/search?q=${encodeURIComponent(q)}`),
  createProject: (body: {
    workspaceId: string
    name: string
    clientName?: string
    handle?: string
    description?: string
    niche?: string
    audience?: string
    voice?: string
    notes?: string
    windowStart?: string
    windowEnd?: string
    hashtags?: string[] | string
  }) =>
    request<{ item: ProjectDto; sync: ProjectSyncSummary | null }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateProject: (
    id: string,
    body: Partial<{
      name: string
      clientName: string
      handle: string
      description: string
      niche: string
      audience: string
      voice: string
      notes: string
      windowStart: string
      windowEnd: string
      hashtags: string[] | string
    }>,
  ) => request<{ item: ProjectDto }>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (id: string) => request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
  syncProject: (id: string) =>
    request<{ item: ProjectDto; sync: ProjectSyncSummary | null; code?: string }>(`/api/projects/${id}/sync`, {
      method: 'POST',
    }),
  notifications: (workspaceId: string, params?: { unread?: boolean; limit?: number }) => {
    const sp = new URLSearchParams({ workspaceId })
    if (params?.unread) sp.set('unread', '1')
    if (params?.limit) sp.set('limit', String(params.limit))
    return request<{ items: NotificationDto[]; unreadCount: number }>(`/api/notifications?${sp}`)
  },
  markNotificationsRead: (workspaceId: string, body: { ids?: string[]; all?: boolean }) =>
    request<{ ok: boolean; unreadCount: number }>('/api/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ workspaceId, ...body }),
    }),
  listCampaigns: (workspaceId: string) =>
    request<{ items: CampaignDto[] }>(`/api/campaigns?workspaceId=${workspaceId}`),
  createCampaign: (body: {
    workspaceId: string
    name: string
    goal?: string
    projectId?: string
    platforms?: string[]
    startDate?: string
    endDate?: string
  }) => request<{ item: CampaignDto }>('/api/campaigns', { method: 'POST', body: JSON.stringify(body) }),
  deleteCampaign: (id: string) => request<{ ok: boolean }>(`/api/campaigns/${id}`, { method: 'DELETE' }),
  listIdeas: (workspaceId: string) => request<{ items: IdeaDto[] }>(`/api/ideas?workspaceId=${workspaceId}`),
  createIdea: (body: {
    workspaceId: string
    title: string
    description?: string
    contentType?: string
    priority?: string
    platforms?: string[]
  }) => request<{ item: IdeaDto }>('/api/ideas', { method: 'POST', body: JSON.stringify(body) }),
  convertIdea: (id: string, body?: { projectId?: string }) =>
    request<{ ok: boolean; contentId: string }>(`/api/ideas/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
  deleteIdea: (id: string) => request<{ ok: boolean }>(`/api/ideas/${id}`, { method: 'DELETE' }),
  team: () =>
    request<{ items: Array<{ id: string; email: string; name: string; role: string; lastLoginAt?: string | null }> }>(
      '/api/team',
    ),
  search: (workspaceId: string, q: string) =>
    request<Record<string, unknown[]>>(`/api/search?workspaceId=${workspaceId}&q=${encodeURIComponent(q)}`),
  listOccasions: (workspaceId: string, params?: { region?: string; projectId?: string; year?: number }) => {
    const sp = new URLSearchParams({ workspaceId })
    if (params?.region) sp.set('region', params.region)
    if (params?.projectId) sp.set('projectId', params.projectId)
    if (params?.year) sp.set('year', String(params.year))
    return request<{ items: OccasionDto[]; year: number }>(`/api/occasions?${sp}`)
  },
  occasionsCalendar: (workspaceId: string, params?: { year?: number; month?: number; projectId?: string }) => {
    const sp = new URLSearchParams({ workspaceId })
    if (params?.year) sp.set('year', String(params.year))
    if (params?.month) sp.set('month', String(params.month))
    if (params?.projectId) sp.set('projectId', params.projectId)
    return request<{ items: OccasionDto[]; year: number }>(`/api/occasions/calendar?${sp}`)
  },
  linkOccasionToProject: (projectId: string, occasionId: string) =>
    request<{ ok: boolean }>('/api/occasions/project-link', {
      method: 'POST',
      body: JSON.stringify({ projectId, occasionId }),
    }),
  unlinkOccasionFromProject: (projectId: string, occasionId: string) =>
    request<{ ok: boolean }>('/api/occasions/project-link', {
      method: 'DELETE',
      body: JSON.stringify({ projectId, occasionId }),
    }),
  createOccasion: (body: {
    workspaceId: string
    nameFa: string
    calendar?: 'jalali' | 'gregorian'
    month: number
    day: number
    projectId?: string
  }) => request<{ item: OccasionDto }>('/api/occasions', { method: 'POST', body: JSON.stringify(body) }),
  deleteOccasion: (id: string) => request<{ ok: boolean }>(`/api/occasions/${id}`, { method: 'DELETE' }),
  runMissedReminders: () =>
    request<{ ok: boolean; checked: number; sent: number }>('/api/content/jobs/remind-missed', {
      method: 'POST',
    }),
}

export interface ContentDto {
  id: string
  workspaceId: string
  title: string
  description?: string
  platforms: string[]
  contentType: string
  status: string
  publishDate?: string
  publishTime?: string
  windowStart?: string
  windowEnd?: string
  occasionId?: string
  remindedAt?: string
  caption?: string
  firstComment?: string
  hashtags: string[]
  notes?: string
  projectId?: string
  campaignId?: string
  createdAt: string
  updatedAt: string
}

export interface OccasionDto {
  id: string
  slug: string
  nameFa: string
  nameEn?: string
  region: 'ir' | 'global' | string
  calendar: 'jalali' | 'gregorian' | string
  month: number
  day: number
  kind: string
  hintFa?: string | null
  hintEn?: string | null
  angle?: string | null
  priority?: number
  endMonth?: number | null
  endDay?: number | null
  workspaceId?: string | null
  custom?: boolean
  dateInYear?: string | null
  dateEndInYear?: string | null
  createdAt: string
}

export interface AssetDto {
  id: string
  filename: string
  type: string
  status: string
  mimeType?: string
  fileSize?: number
  width?: number
  height?: number
  tags: string[]
  createdAt: string
}

export interface TelegramChatDto {
  chatId: string
  title: string
  username: string | null
  type: string
  memberStatus: string | null
  connected: boolean
  ingesting: boolean
  fileCount: number
  lastFileAt: string | null
  lastSeenAt: string | null
  notifyChat: boolean
}

export type AnalyticsConnector = {
  id: 'instagram_public' | 'supermetrics' | 'meta' | 'website' | 'ads_library'
  name: string
  configured: boolean
  hint: string
}

export type PagePostInsight = {
  shortcode: string
  url: string
  type: 'reel' | 'carousel' | 'post'
  caption: string
  likes: number
  comments: number
  views?: number
  takenAt: string
  thumbUrl?: string
  engagement: number
  hasAudio?: boolean
  originalAudio?: boolean
  songName?: string
  artistName?: string
  locationName?: string
  taggedUsers: string[]
  hashtags: string[]
  mentions: string[]
  captionLength: number
  commentsDisabled?: boolean
  isPinned?: boolean
}

export type TypeStats = {
  count: number
  avgLikes: number
  avgComments: number
  avgViews: number
  avgEngagement: number
}

export type CountStat = { key: string; count: number; avgEngagement: number }

export type HealthPart = { id: string; score: number; max: number }

export type InsightHint = { id: string; args?: Record<string, string | number> }

export type RelatedProfile = {
  username: string
  name: string
  verified?: boolean
  avatarUrl?: string
  followers?: number
}

export type PageInsights = {
  handle: string
  name: string
  biography: string
  avatarUrl?: string
  verified: boolean
  isProfessional: boolean
  isBusiness: boolean
  isPrivate: boolean
  category?: string
  followers: number
  following: number
  posts: number
  avgLikes: number
  avgComments: number
  avgViews: number
  engagementRate: number
  postCadenceDays: number | null
  mix: { reel: number; carousel: number; post: number }
  bestPost?: PagePostInsight
  weakestPost?: PagePostInsight
  recentPosts: PagePostInsight[]
  hints: InsightHint[]
  fetchedAt: string
  source: 'instagram_public'
  highlightCount: number
  hasClips: boolean
  isJoinedRecently: boolean
  hideLikeCounts: boolean
  contactMethod?: string
  website?: string
  bioLinks: Array<{ title?: string; url: string }>
  phone?: string
  email?: string
  telegram?: string
  igUserId?: string
  fbId?: string
  relatedProfiles: RelatedProfile[]
  avgCaptionLength: number
  pinnedCount: number
  lastPostedAt?: string
  postingStdevDays: number | null
  followerFollowingRatio: number
  commentsToLikes: number
  reelPlayRate: number | null
  byType: { reel: TypeStats; carousel: TypeStats; post: TypeStats }
  heatmapDays: CountStat[]
  heatmapHours: CountStat[]
  bestDay?: string
  bestHour?: string
  topHashtags: CountStat[]
  collaborators: CountStat[]
  locations: CountStat[]
  audioMix: { original: number; licensed: number }
  suggestedWindow?: string
  health: { score: number; parts: HealthPart[] }
}

export type PageGrowth = {
  previousFetchedAt?: string
  previousFollowers?: number
  followerDelta?: number
  previousPosts?: number
  postsDelta?: number
  previousEngagement?: number
  engagementDelta?: number
  samples: number
  history?: Array<{ fetchedAt: string; followers: number; posts: number; engagementRate: number }>
}

export type PageEnrichment = {
  website?: {
    url: string
    title?: string
    description?: string
    sameAs?: string[]
    address?: string
    telephone?: string
    email?: string
  }
  wikidata?: { id: string; label: string; description?: string; website?: string; wikiFa?: string; wikiEn?: string }
  wikipedia?: { title: string; extract: string; url: string; lang: 'fa' | 'en' }
  domain?: { host: string; createdAt?: string; registrar?: string }
  place?: { name: string; displayName: string; lat: string; lon: string }
  researchLinks: Array<{ id?: string; label: string; url: string; hint: string }>
}

export interface CollabDto {
  id: string
  workspaceId: string
  handle: string
  name: string
  notes: string
  snapshot: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type PageAnalyticsResponse = {
  page: PageInsights
  growth?: PageGrowth
  enrichment?: PageEnrichment
  connectors: AnalyticsConnector[]
  cached?: boolean
  staleReason?: 'not_found' | 'rate_limit' | 'unavailable'
  supermetrics: { ok: boolean; error?: string; rows?: unknown[]; fields?: string[] }
  meta: { ok: false; error?: string; data?: unknown } | { ok: boolean; error?: string; data?: unknown }
}

export interface IgPageHit {
  username: string
  name: string
  biography?: string
  avatarUrl?: string
  verified?: boolean
  followers?: number
  source?: 'instagram' | 'workspace' | 'typed' | 'wikidata'
}

export interface ProjectDto {
  id: string
  workspaceId: string
  name: string
  clientName?: string
  handle?: string
  description?: string
  niche?: string
  audience?: string
  voice?: string
  notes?: string
  windowStart?: string
  windowEnd?: string
  hashtags?: string[]
  createdAt: string
  igConnectedAt?: string | null
  igLastSyncedAt?: string | null
  igLastAttemptAt?: string | null
  igSyncStatus?: IgSyncStatus | null
  igSyncError?: string | null
  live?: ProjectLive | null
}

export type IgSyncStatus = 'live' | 'cooldown' | 'error' | 'pending'

export interface ProjectLive {
  followers: number
  following: number
  posts: number
  name: string
  biography: string
  isPrivate: boolean
  website?: string | null
  lastPostAt?: string | null
  engagementRate: number
  avgLikes: number
  fetchedAt: string
}

export type NotificationKind =
  | 'page_connected'
  | 'new_post'
  | 'followers_up'
  | 'followers_down'
  | 'bio_changed'
  | 'name_changed'
  | 'website_changed'
  | 'privacy_changed'
  | 'post_removed'
  | 'sync_error'

export interface NotificationDto {
  id: string
  projectId?: string | null
  handle?: string | null
  kind: NotificationKind | string
  title: string
  body?: string | null
  url?: string | null
  meta: Record<string, unknown>
  readAt?: string | null
  createdAt: string
}

export type ProjectSyncSummary =
  | { ok: true; status: 'live'; cached: boolean; events: Array<{ kind: string; meta: Record<string, unknown>; url?: string }> }
  | { ok: false; status: 'cooldown' | 'error'; code: string; retryInSec?: number }

export interface CampaignDto {
  id: string
  workspaceId: string
  projectId?: string
  name: string
  goal?: string
  status: string
  platforms: string[]
  startDate?: string
  endDate?: string
  createdAt: string
}

export interface IdeaDto {
  id: string
  workspaceId: string
  title: string
  description?: string
  contentType?: string
  priority: string
  platforms: string[]
  tags: string[]
  convertedContentId?: string
  createdAt: string
}
