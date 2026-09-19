import assert from 'node:assert/strict'
import {
  igPayloadSaysLogin,
  igPayloadSaysWait,
  igProbePolicy,
  igShouldStopFollowup,
  isLikelyIgHandle,
  normalizeHandle,
  shouldTryFeedFallback,
} from './instagramSearch.js'

assert.equal(igProbePolicy(200), 'ok')
assert.equal(igProbePolicy(429), 'rate_limit')
assert.equal(igProbePolicy(401), 'rate_limit')
assert.equal(igProbePolicy(404), 'not_found')
assert.equal(igProbePolicy(500), 'fallback')
assert.equal(igProbePolicy(0), 'fallback')
assert.equal(igShouldStopFollowup(429), true)
assert.equal(igShouldStopFollowup(401), true)
assert.equal(
  igShouldStopFollowup(200, { message: 'Please wait a few minutes before you try again.' }),
  true,
)
assert.equal(igShouldStopFollowup(500), false)
assert.equal(igPayloadSaysWait({ message: 'Please wait a few minutes' }), true)
assert.equal(igPayloadSaysWait({ message: 'ok' }), false)
assert.equal(igPayloadSaysLogin({ message: 'login_required', error_title: "You've Been Logged Out" }), true)
assert.equal(igShouldStopFollowup(403, { message: 'login_required' }), true)
assert.equal(
  shouldTryFeedFallback(400, { message: 'Asset asset://laser.provider/ig_business_category_subvertical has been deleted' }, null),
  true,
)
assert.equal(shouldTryFeedFallback(401, { message: 'fail' }, null), false)
assert.equal(shouldTryFeedFallback(429, undefined, null), false)
assert.equal(shouldTryFeedFallback(404, undefined, null), false)
assert.equal(
  shouldTryFeedFallback(200, { status: 'ok' }, {
    username: 'rasta',
    edge_owner_to_timeline_media: { edges: [{ node: { shortcode: 'abc' } }] },
  }),
  false,
)
assert.equal(normalizeHandle('@mashhad_koodak/'), 'mashhad_koodak')
assert.equal(isLikelyIgHandle('mashhad_koodak'), true)
assert.equal(isLikelyIgHandle('karaland.official'), true)
console.log('ig fetch policy ok')
