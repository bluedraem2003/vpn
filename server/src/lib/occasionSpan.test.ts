import assert from 'node:assert/strict'
import { occasionSpanDays } from '../../../src/lib/occasionSpan.ts'

assert.deepEqual(occasionSpanDays({ dateInYear: '2026-10-05' }), ['2026-10-05'])
assert.deepEqual(
  occasionSpanDays({ dateInYear: '2026-10-04', dateEndInYear: '2026-10-10' }),
  [
    '2026-10-04',
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
    '2026-10-08',
    '2026-10-09',
    '2026-10-10',
  ],
)
assert.deepEqual(occasionSpanDays({ dateInYear: null }), [])

console.log('occasion span ok')
