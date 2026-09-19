const API_BASE = import.meta.env.VITE_API_URL || ''

let authToken: string | null =
  typeof localStorage !== 'undefined' ? localStorage.getItem('postyar_session_token') : null

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  }
  if (init?.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' })
  const ct = res.headers.get('content-type') || ''
  const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : {}
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `خطای API (${res.status})`)
  }
  if (ct && !ct.includes('application/json')) {
    throw new Error('پاسخ نامعتبر از سرور — یک‌بار رفرش اجباری کنید (Ctrl+Shift+R)')
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
      shareInviteLinks?: boolean
      publicUrl?: string | null
    }>('/api/auth/bootstrap'),
  requestMagicLink: (email: string) =>
    request<{
      ok: boolean
      message: string
      inviteUrl?: string
      devMagicUrl?: string
      magicToken?: string
      expiresAt: string
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
  updateAsset: (id: string, body: { tags?: string[]; status?: string; virtualFolder?: string }) =>
    request<{ item: AssetDto }>(`/api/assets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  inviteMember: (body: { email: string; name?: string; role?: string }) =>
    request<{
      ok: boolean
      member: { id: string; email: string; name: string; role: string }
      invite: { expiresAt: string; inviteUrl: string; devMagicUrl: string }
    }>('/api/team/invite', { method: 'POST', body: JSON.stringify(body) }),
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
    request<{ configured: boolean; chatIdConfigured: boolean; indexedFiles: number; limits: Record<string, unknown> }>(
      '/api/telegram/status',
    ),
  listProjects: (workspaceId: string) =>
    request<{ items: ProjectDto[] }>(`/api/projects?workspaceId=${workspaceId}`),
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
  }) => request<{ item: ProjectDto }>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
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
    request<{ items: Array<{ id: string; email: string; name: string; role: string }> }>('/api/team'),
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
  workspaceId?: string | null
  custom?: boolean
  dateInYear?: string | null
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
}

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
