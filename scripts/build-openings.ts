// Regenerates src/data/openings.json from Lichess's opening list (CC0). The JSON is committed, so
// this only needs to run when pulling in upstream changes:
//   node scripts/build-openings.ts
import { writeFileSync } from 'node:fs'
import { Chess } from 'chess.js'

const SOURCE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master'
const OUT = new URL('../src/data/openings.json', import.meta.url)

type Row = [eco: string, name: string, moves: string, epd: string]

const rows: Row[] = []
for (const file of ['a', 'b', 'c', 'd', 'e']) {
  const res = await fetch(`${SOURCE}/${file}.tsv`)
  if (!res.ok) throw new Error(`${file}.tsv: HTTP ${res.status}`)
  const lines = (await res.text()).trim().split('\n').slice(1)
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t')
    const chess = new Chess()
    const sans = pgn.split(' ').filter((token) => !/^\d+\.$/.test(token))
    for (const san of sans) chess.move(san)
    rows.push([eco, name, sans.join(' '), epd(chess.fen())])
  }
}

writeFileSync(OUT, JSON.stringify(rows))
console.log(`${rows.length} openings → ${OUT.pathname}`)

// A FEN without the halfmove and fullmove counters, so the same position reached in a different
// move order compares equal.
function epd(fen: string) {
  return fen.split(' ').slice(0, 4).join(' ')
}
