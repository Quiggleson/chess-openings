// Writes src/data/popularity.json: how many Lichess games reached each opening's final position.
// The explorer needs a Lichess API token (no scopes) and wants one request at a time. Runs in the
// Popularity workflow; locally:
//   LICHESS_TOKEN=… node scripts/fetch-popularity.ts
import { readFileSync, writeFileSync } from 'node:fs'

const EXPLORER = 'https://explorer.lichess.ovh/lichess'
const DATA = new URL('../src/data/openings.json', import.meta.url)
const OUT = new URL('../src/data/popularity.json', import.meta.url)

const token = process.env.LICHESS_TOKEN
if (!token) throw new Error('Set LICHESS_TOKEN to a Lichess API token')

const rows: [string, string, string, string][] = JSON.parse(readFileSync(DATA, 'utf8'))
const positions = [...new Set(rows.map(([, , , epd]) => epd))]

const games: Record<string, number> = {}
for (const [i, epd] of positions.entries()) {
  games[epd] = await count(epd)
  if ((i + 1) % 250 === 0) console.log(`${i + 1} / ${positions.length}`)
}

writeFileSync(OUT, JSON.stringify(games))
console.log(`${positions.length} positions → ${OUT.pathname}`)

async function count(epd: string): Promise<number> {
  const params = new URLSearchParams({ variant: 'standard', fen: `${epd} 0 1`, moves: '0', topGames: '0', recentGames: '0' })
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${EXPLORER}?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const { white, draws, black } = await res.json()
      return white + draws + black
    }
    // Lichess asks clients that hit the rate limit to wait a full minute before retrying.
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      console.log(`HTTP ${res.status} on ${epd}; waiting a minute`)
      await new Promise((resolve) => setTimeout(resolve, 60_000))
      continue
    }
    throw new Error(`HTTP ${res.status} on ${epd}: ${await res.text()}`)
  }
}
