import { db } from '../db/index.js'

export function resolveProjectId(
  workspaceId: string,
  projectId: unknown,
): { id: string | null; error?: string } {
  if (!projectId) return { id: null }
  const id = String(projectId)
  const row = db
    .prepare(`SELECT id FROM projects WHERE id = ? AND workspace_id = ?`)
    .get(id, workspaceId)
  if (!row) return { id: null, error: 'پیج نامعتبر است — دوباره از لیست انتخاب کنید' }
  return { id }
}

export function resolveCampaignId(
  workspaceId: string,
  campaignId: unknown,
): { id: string | null; error?: string } {
  if (!campaignId) return { id: null }
  const id = String(campaignId)
  const row = db
    .prepare(`SELECT id FROM campaigns WHERE id = ? AND workspace_id = ?`)
    .get(id, workspaceId)
  if (!row) return { id: null, error: 'کمپین نامعتبر است — دوباره از لیست انتخاب کنید' }
  return { id }
}
