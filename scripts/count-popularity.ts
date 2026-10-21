// Writes src/data/popularity.json: for each opening line, how many games in a Lichess database
// dump followed it move for move from the start. Reads PGN on stdin and stops after --games:
//   curl -sL https://database.lichess.org/standard/lichess_db_standard_rated_2026-09.pgn.zst \
//     | zstd -dc | node scripts/count-popularity.ts --games 5000000
// Matching is by move order, so a game that transposes into a line is not counted for it. That
// undercounts some lines a little but needs no move generation, which keeps millions of games fast.
import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const DATA = new URL('../src/data/openings.json', import.meta.url)
const OUT = new URL('../src/data/popularity.json', import.meta.url)
const flag = process.argv.indexOf('--games')
const limit = flag > 0 ? Number(process.argv[flag + 1]) : Infinity

const rows: [string, string, string, string][] = JSON.parse(readFileSync(DATA, 'utf8'))
// Line (space-separated SAN) → the positions it ends in, and every prefix of every line, so a
// game stops being read as soon as it leaves the book.
const lines = new Map<string, string[]>()
const prefixes = new Set<string>()
let longest = 0
for (const [, , moves, epd] of rows) {
  lines.set(moves, [...(lines.get(moves) ?? []), epd])
  const sans = moves.split(' ')
  longest = Math.max(longest, sans.length)
  for (let i = 1; i <= sans.length; i++) prefixes.add(sans.slice(0, i).join(' '))
}

const games: Record<string, number> = {}
let seen = 0
const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of input) {
  // Movetext is the only line of a game that starts with a move number.
  if (!line.startsWith('1.')) continue
  count(sans(line))
  if (++seen % 500_000 === 0) console.log(`${seen.toLocaleString()} games`)
  if (seen >= limit) break
}
input.close()
process.stdin.destroy()

writeFileSync(OUT, JSON.stringify(games))
console.log(`${seen.toLocaleString()} games → ${Object.keys(games).length} positions → ${OUT.pathname}`)

function count(moves: string[]) {
  let prefix = ''
  for (const san of moves) {
    prefix = prefix ? `${prefix} ${san}` : san
    if (!prefixes.has(prefix)) return
    for (const epd of lines.get(prefix) ?? []) games[epd] = (games[epd] ?? 0) + 1
  }
}

// "1. e4 { [%clk 0:03:00] } 1... e5?! 2. Nf3" → ["e4", "e5", "Nf3"], only as far as any line goes.
function sans(movetext: string) {
  return movetext
    .replace(/\{[^}]*\}/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !/^\d+\.+$/.test(token) && !token.startsWith('$') && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token))
    .slice(0, longest)
    .map((san) => san.replace(/[?!]+$/, ''))
}
