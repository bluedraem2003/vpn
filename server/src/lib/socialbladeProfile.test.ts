import assert from 'node:assert/strict'
import { parseSocialBladeHtml, socialBladeUserAsGraph } from './socialbladeProfile.ts'

const html = `<html><script id="__NEXT_DATA__">${JSON.stringify({
  props: {
    pageProps: {
      trpcState: {
        json: {
          queries: [
            { state: { data: null }, queryKey: [['auth']] },
            {
              state: {
                data: {
                  id: '17841472828704623',
                  username: 'tablofood',
                  displayName: 'tablofood',
                  avatar: 'https://example.com/a.jpg',
                  website: null,
                  followers: '3463',
                  following: 1,
                  mediaCount: 37,
                  engagementRate: 9.68,
                  averageLikes: 313.25,
                  averageComments: 22.125,
                  stats: {
                    followers: '3463',
                    following: 1,
                    mediaCount: 37,
                    engagementRate: 9.68,
                    averageLikes: 313.25,
                    averageComments: 22.125,
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
})}</script></html>`

const stats = parseSocialBladeHtml(html)
assert.ok(stats)
assert.equal(stats.username, 'tablofood')
assert.equal(stats.followers, 3463)
assert.equal(stats.mediaCount, 37)
assert.equal(stats.following, 1)
assert.ok(stats.engagementRate > 9)

const graph = socialBladeUserAsGraph(stats)
assert.equal((graph.edge_followed_by as { count: number }).count, 3463)
assert.equal((graph.edge_owner_to_timeline_media as { count: number }).count, 37)
assert.equal(graph.username, 'tablofood')

assert.equal(parseSocialBladeHtml('<html>no data</html>'), null)

console.log('socialblade profile parse ok')
