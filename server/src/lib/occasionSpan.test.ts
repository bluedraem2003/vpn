import assert from 'node:assert/strict'
import {
  occasionSpanDays,
  pickOccasionForDate,
  publishDateForOccasion,
} from '../../../src/lib/occasionSpan.ts'

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

const space = {
  id: 'space',
  dateInYear: '2026-10-04',
  dateEndInYear: '2026-10-10',
  priority: 5,
}
const child = { id: 'child', dateInYear: '2026-10-08', dateEndInYear: null, priority: 5 }
const teacher = { id: 'teacher', dateInYear: '2026-10-05', dateEndInYear: null, priority: 5 }
const pool = [space, child, teacher]

assert.equal(pickOccasionForDate(pool, '2026-10-08')?.id, 'child')
assert.equal(pickOccasionForDate(pool, '2026-10-07')?.id, 'space')
assert.equal(pickOccasionForDate(pool, '2026-10-05')?.id, 'teacher')
assert.equal(publishDateForOccasion(space, '2026-10-07'), '2026-10-07')
assert.equal(publishDateForOccasion(space, '2026-10-01'), '2026-10-04')

const village = { id: 'village', dateInYear: '2026-10-07', dateEndInYear: null, priority: 3 }
assert.equal(pickOccasionForDate([space, village], '2026-10-07')?.id, 'village')
assert.equal(
  pickOccasionForDate([space, village], '2026-10-07', new Set(['space']))?.id,
  'space',
)

console.log('occasion span ok')
