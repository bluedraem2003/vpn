/** Map Instagram's /api/v1/feed/user/{username}/username/ items to GraphQL-shaped edges. */

function num(v: unknown) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

export function hasTimelineEdges(user: Record<string, unknown> | null | undefined) {
  const edges = (user?.edge_owner_to_timeline_media as { edges?: unknown[] } | undefined)?.edges
  return Array.isArray(edges) && edges.some((e) => e && typeof e === 'object' && (e as { node?: unknown }).node)
}

export function hasFollowerCount(user: Record<string, unknown> | null | undefined) {
  const followed = num((user?.edge_followed_by as { count?: number } | undefined)?.count)
  return followed > 0 || num(user?.follower_count) > 0
}

export function feedItemsFromPayload(data: unknown): Array<Record<string, unknown>> {
  if (!data || typeof data !== 'object') return []
  const items = (data as { items?: unknown }).items
  if (!Array.isArray(items)) return []
  return items.filter((it): it is Record<string, unknown> => Boolean(it) && typeof it === 'object' && !Array.isArray(it))
}

function imageUrl(item: Record<string, unknown>) {
  const versions = item.image_versions2 as { candidates?: Array<{ url?: string }> } | undefined
  const first = versions?.candidates?.[0]?.url
  if (first) return String(first)
  if (item.display_uri) return String(item.display_uri)
  if (item.thumbnail_url) return String(item.thumbnail_url)
  return ''
}

function captionText(item: Record<string, unknown>) {
  const cap = item.caption
  if (typeof cap === 'string') return cap
  if (cap && typeof cap === 'object' && 'text' in cap) return String((cap as { text?: string }).text || '')
  return ''
}

function taggedEdges(item: Record<string, unknown>) {
  const tags = item.usertags as { in?: Array<{ user?: { username?: string } }> } | undefined
  const people = Array.isArray(tags?.in) ? tags.in : []
  return people
    .map((row) => String(row?.user?.username || '').trim())
    .filter(Boolean)
    .map((username) => ({ node: { user: { username } } }))
}

function musicInfo(item: Record<string, unknown>) {
  const clips = (item.clips_metadata && typeof item.clips_metadata === 'object' ? item.clips_metadata : {}) as Record<
    string,
    unknown
  >
  const original = clips.original_sound_info as { original_audio_title?: string } | undefined
  const music = clips.music_info as
    | { uses_original_audio?: boolean; music_asset_info?: { title?: string; display_artist?: string } }
    | undefined
  if (!original && !music) return undefined
  return {
    uses_original_audio: Boolean(original) || Boolean(music?.uses_original_audio),
    song_name: original?.original_audio_title || music?.music_asset_info?.title || '',
    artist_name: music?.music_asset_info?.display_artist || '',
  }
}

function isVideo(item: Record<string, unknown>) {
  return item.media_type === 2 || item.product_type === 'clips' || item.product_type === 'igtv'
}

function isCarousel(item: Record<string, unknown>) {
  return item.media_type === 8 || item.product_type === 'carousel_container'
}

export function feedItemToGraphNode(item: Record<string, unknown>): Record<string, unknown> {
  const likes = num(item.like_count)
  const comments = num(item.comment_count)
  const views = item.play_count ?? item.ig_play_count ?? item.view_count
  const loc = item.location as { name?: string } | null | undefined
  const pinned =
    (Array.isArray(item.timeline_pinned_user_ids) && item.timeline_pinned_user_ids.length > 0) ||
    (Array.isArray(item.clips_tab_pinned_user_ids) && item.clips_tab_pinned_user_ids.length > 0)
  return {
    shortcode: String(item.code || ''),
    __typename: isCarousel(item) ? 'GraphSidecar' : isVideo(item) ? 'GraphVideo' : 'GraphImage',
    is_video: isVideo(item),
    product_type: item.product_type || (isCarousel(item) ? 'carousel_container' : isVideo(item) ? 'clips' : 'feed'),
    taken_at_timestamp: num(item.taken_at),
    thumbnail_src: imageUrl(item),
    display_url: imageUrl(item),
    edge_liked_by: { count: likes },
    edge_media_preview_like: { count: likes },
    edge_media_to_comment: { count: comments },
    video_view_count: views == null ? undefined : num(views),
    edge_media_to_caption: { edges: [{ node: { text: captionText(item) } }] },
    has_audio: item.has_audio == null ? undefined : Boolean(item.has_audio),
    clips_music_attribution_info: musicInfo(item),
    location: loc?.name ? { name: String(loc.name) } : null,
    edge_media_to_tagged_user: { edges: taggedEdges(item) },
    comments_disabled: Boolean(item.comments_disabled || item.disable_caption_and_comment),
    pinned_for_users: pinned ? [{}] : [],
  }
}

export function feedItemsToGraphEdges(data: unknown): Array<{ node: Record<string, unknown> }> {
  return feedItemsFromPayload(data)
    .map(feedItemToGraphNode)
    .filter((node) => node.shortcode)
    .map((node) => ({ node }))
}

export function userFromFeedPayload(data: unknown, fallbackHandle: string): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null
  const raw = (data as { user?: Record<string, unknown> }).user
  const items = feedItemsFromPayload(data)
  const fromItem = items[0]?.user as Record<string, unknown> | undefined
  const u = raw && typeof raw === 'object' ? raw : fromItem
  const username = String(u?.username || fallbackHandle || '').trim()
  if (!username && items.length === 0) return null
  const handle = username || fallbackHandle
  const edges = feedItemsToGraphEdges(data)
  return {
    username: handle,
    full_name: String(u?.full_name || handle),
    biography: String(u?.biography || ''),
    profile_pic_url: String(u?.profile_pic_url || ''),
    is_verified: Boolean(u?.is_verified),
    is_private: Boolean(u?.is_private),
    is_professional_account: true,
    id: u?.pk != null ? String(u.pk) : u?.id != null ? String(u.id) : undefined,
    edge_followed_by: { count: num(u?.follower_count) },
    edge_follow: { count: num(u?.following_count) },
    edge_owner_to_timeline_media: {
      count: num(u?.media_count) || edges.length,
      edges,
    },
  }
}

export function attachTimelineEdges(
  user: Record<string, unknown>,
  edges: Array<{ node: Record<string, unknown> }>,
): Record<string, unknown> {
  const prev = user.edge_owner_to_timeline_media as { count?: number; edges?: unknown[] } | undefined
  return {
    ...user,
    edge_owner_to_timeline_media: {
      count: num(prev?.count) || edges.length,
      edges,
    },
  }
}

export function mergeProfileWithFeed(
  base: Record<string, unknown>,
  overlay: Record<string, unknown> | null | undefined,
  edges: Array<{ node: Record<string, unknown> }>,
): Record<string, unknown> {
  const overlayCount = num(
    (overlay?.edge_owner_to_timeline_media as { count?: number } | undefined)?.count,
  )
  const baseCount = num((base.edge_owner_to_timeline_media as { count?: number } | undefined)?.count)
  const merged: Record<string, unknown> = {
    ...base,
    ...(overlay || {}),
    username: String(overlay?.username || base.username || ''),
    full_name: String(overlay?.full_name || base.full_name || overlay?.username || base.username || ''),
    biography: String(overlay?.biography || base.biography || ''),
    profile_pic_url: overlay?.profile_pic_url || base.profile_pic_url,
    id: overlay?.id || base.id,
    edge_followed_by: base.edge_followed_by || overlay?.edge_followed_by,
    edge_follow: base.edge_follow || overlay?.edge_follow,
    external_url: overlay?.external_url || base.external_url,
    edge_owner_to_timeline_media: { count: Math.max(overlayCount, baseCount, edges.length), edges: [] },
  }
  return attachTimelineEdges(merged, edges)
}
