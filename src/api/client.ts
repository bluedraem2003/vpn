const API_BASE = import.meta.env.VITE_API_URL || ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `خطای API (${res.status})`)
  }
  return data as T
}

export const api = {
  health: () => request<{ ok: boolean; telegramConfigured: boolean }>('/api/health'),
  workspaces: () =>
    request<{ items: Array<{ id: string; name: string; slug: string }> }>('/api/workspaces'),
  dashboard: (workspaceId: string) => request<Record<string, unknown>>(`/api/workspaces/${workspaceId}/dashboard`),
  listContent: (workspaceId: string, status?: string) =>
    request<{ items: ContentDto[] }>(
      `/api/content?workspaceId=${workspaceId}${status ? `&status=${status}` : ''}`,
    ),
  createContent: (body: Partial<ContentDto> & { workspaceId: string; title: string; contentType: string }) =>
    request<{ item: ContentDto }>('/api/content', { method: 'POST', body: JSON.stringify(body) }),
  updateContent: (id: string, body: Partial<ContentDto>) =>
    request<{ item: ContentDto }>(`/api/content/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteContent: (id: string) => request<{ ok: boolean }>(`/api/content/${id}`, { method: 'DELETE' }),
  listAssets: (workspaceId: string, params?: { type?: string; q?: string; sort?: string }) => {
    const sp = new URLSearchParams({ workspaceId, ...params })
    return request<{ items: AssetDto[] }>(`/api/assets?${sp}`)
  },
  telegramStatus: () =>
    request<{ configured: boolean; chatIdConfigured: boolean; indexedFiles: number; limits: Record<string, unknown> }>(
      '/api/telegram/status',
    ),
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
  caption?: string
  hashtags: string[]
  notes?: string
  projectId?: string
  campaignId?: string
  createdAt: string
  updatedAt: string
}

export interface AssetDto {
  id: string
  filename: string
  type: string
  status: string
  fileSize?: number
  width?: number
  height?: number
  tags: string[]
  createdAt: string
}
