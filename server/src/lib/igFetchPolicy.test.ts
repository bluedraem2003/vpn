import assert from 'node:assert/strict'
import { igProbePolicy, isLikelyIgHandle, normalizeHandle } from './instagramSearch.js'

assert.equal(igProbePolicy(200), 'ok')
assert.equal(igProbePolicy(429), 'rate_limit')
assert.equal(igProbePolicy(401), 'fallback')
assert.equal(igProbePolicy(404), 'not_found')
assert.equal(igProbePolicy(500), 'fallback')
assert.equal(igProbePolicy(0), 'fallback')
assert.equal(normalizeHandle('@mashhad_koodak/'), 'mashhad_koodak')
assert.equal(isLikelyIgHandle('mashhad_koodak'), true)
assert.equal(isLikelyIgHandle('karaland.official'), true)
console.log('ig fetch policy ok')
