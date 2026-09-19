import assert from 'node:assert/strict'
import {
  igPayloadSaysWait,
  igProbePolicy,
  igShouldStopFollowup,
  isLikelyIgHandle,
  normalizeHandle,
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
assert.equal(normalizeHandle('@mashhad_koodak/'), 'mashhad_koodak')
assert.equal(isLikelyIgHandle('mashhad_koodak'), true)
assert.equal(isLikelyIgHandle('karaland.official'), true)
console.log('ig fetch policy ok')
