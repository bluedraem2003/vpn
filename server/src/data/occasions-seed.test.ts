import assert from 'node:assert/strict'
import { KARALAND_OCCASION_SLUGS, OCCASION_SEEDS } from './occasions-seed.ts'
import { occasionDateInYear, toGregorian } from '../lib/jalaali.ts'

const slugs = OCCASION_SEEDS.map((o) => o.slug)
assert.equal(new Set(slugs).size, slugs.length, 'duplicate occasion slugs')

const bySlug = Object.fromEntries(OCCASION_SEEDS.map((o) => [o.slug, o]))

assert.equal(bySlug['school-year-start']?.month, 7)
assert.equal(bySlug['school-year-start']?.day, 1)
assert.equal(bySlug['mehregan']?.day, 10)
assert.equal(bySlug['national-childrens-day']?.day, 16)
assert.equal(bySlug['world-space-week']?.month, 10)
assert.equal(bySlug['world-space-week']?.day, 4)
assert.equal(bySlug['world-space-week']?.endDay, 10)
assert.equal(bySlug['world-teachers-day']?.day, 5)
assert.equal(bySlug['international-day-of-the-girl']?.day, 11)
assert.equal(bySlug['world-food-day']?.day, 16)

const mehr1 = toGregorian(1405, 7, 1)
assert.deepEqual(mehr1, { gy: 2026, gm: 9, gd: 23 })
assert.equal(occasionDateInYear('gregorian', 10, 5, 2026), '2026-10-05')
assert.equal(occasionDateInYear('gregorian', 10, 11, 2026), '2026-10-11')
assert.equal(occasionDateInYear('jalali', 7, 16, 2026), '2026-10-08')

for (const slug of KARALAND_OCCASION_SLUGS) {
  assert.ok(bySlug[slug], `missing karaland slug ${slug}`)
  assert.ok((bySlug[slug].priority || 0) >= 4, `karaland ${slug} should be high priority`)
}

assert.equal(bySlug['rumi-commemoration']?.priority, 2)
assert.equal(
  (KARALAND_OCCASION_SLUGS as readonly string[]).includes('rumi-commemoration'),
  false,
)

console.log('karaland mehr occasions ok')
