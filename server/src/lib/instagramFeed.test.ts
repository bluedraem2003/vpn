import assert from 'node:assert/strict'
import {
  attachTimelineEdges,
  feedItemToGraphNode,
  feedItemsToGraphEdges,
  hasFollowerCount,
  hasTimelineEdges,
  mergeProfileWithFeed,
  userFromFeedPayload,
} from './instagramFeed.ts'

const reel = {
  code: 'DSFwzEPDER-',
  pk: '3784645677348045950',
  taken_at: 1765385172,
  media_type: 2,
  product_type: 'clips',
  like_count: 1334,
  comment_count: 99,
  play_count: 87532,
  has_audio: true,
  caption: { text: 'پنج‌شنبه؛ همبرگر سبزواری\n#tablofood' },
  image_versions2: { candidates: [{ url: 'https://cdn.example/thumb.jpg' }] },
  usertags: { in: [{ user: { username: 'guest.chef' } }] },
  location: { name: 'Mashhad' },
  clips_metadata: {
    original_sound_info: { original_audio_title: 'Original audio' },
  },
  user: { username: 'tablofood', pk: '72836987623' },
}

const photo = {
  code: 'DRka8OyEr6K',
  taken_at: 1764266188,
  media_type: 1,
  product_type: 'feed',
  like_count: 69,
  comment_count: 4,
  caption: { text: 'شیشه‌های سبز' },
  display_uri: 'https://cdn.example/photo.jpg',
}

const carousel = {
  code: 'DQzaAp9ks0R',
  taken_at: 1762621533,
  media_type: 8,
  product_type: 'carousel_container',
  like_count: 326,
  comment_count: 11,
  caption: { text: 'صبحانه' },
  display_uri: 'https://cdn.example/car.jpg',
}

const node = feedItemToGraphNode(reel)
assert.equal(node.shortcode, 'DSFwzEPDER-')
assert.equal(node.__typename, 'GraphVideo')
assert.equal(node.is_video, true)
assert.equal((node.edge_liked_by as { count: number }).count, 1334)
assert.equal((node.edge_media_to_comment as { count: number }).count, 99)
assert.equal(node.video_view_count, 87532)
assert.equal(
  (node.edge_media_to_caption as { edges: Array<{ node: { text: string } }> }).edges[0]!.node.text.includes(
    'همبرگر',
  ),
  true,
)
assert.equal((node.location as { name: string }).name, 'Mashhad')
assert.equal(
  (node.edge_media_to_tagged_user as { edges: Array<{ node: { user: { username: string } } }> }).edges[0]!.node
    .user.username,
  'guest.chef',
)
assert.equal((node.clips_music_attribution_info as { uses_original_audio: boolean }).uses_original_audio, true)

assert.equal(feedItemToGraphNode(photo).__typename, 'GraphImage')
assert.equal(feedItemToGraphNode(carousel).__typename, 'GraphSidecar')

const edges = feedItemsToGraphEdges({
  items: [reel, photo, carousel, { like_count: 1 }],
  user: { username: 'tablofood', pk: '72836987623', full_name: '' },
})
assert.equal(edges.length, 3)
assert.equal(edges[0]!.node.shortcode, 'DSFwzEPDER-')

const fromFeed = userFromFeedPayload(
  { items: [reel, photo], user: { username: 'tablofood', pk: '72836987623' } },
  'tablofood',
)
assert.ok(fromFeed)
assert.equal(fromFeed.username, 'tablofood')
assert.equal(hasTimelineEdges(fromFeed), true)
assert.equal(hasFollowerCount(fromFeed), false)
assert.equal(hasTimelineEdges({ edge_owner_to_timeline_media: { count: 37, edges: [] } }), false)
assert.equal(hasFollowerCount({ edge_followed_by: { count: 3463 } }), true)

const merged = mergeProfileWithFeed(
  {
    username: 'tablofood',
    full_name: 'Tablo',
    edge_followed_by: { count: 3463 },
    edge_owner_to_timeline_media: { count: 37, edges: [] },
  },
  fromFeed,
  edges,
)
assert.equal((merged.edge_followed_by as { count: number }).count, 3463)
assert.equal((merged.edge_owner_to_timeline_media as { count: number; edges: unknown[] }).count, 37)
assert.equal((merged.edge_owner_to_timeline_media as { edges: unknown[] }).edges.length, 3)

const attached = attachTimelineEdges({ username: 'x', edge_owner_to_timeline_media: { count: 2, edges: [] } }, edges)
assert.equal((attached.edge_owner_to_timeline_media as { edges: unknown[] }).edges.length, 3)

console.log('instagram feed map ok')
