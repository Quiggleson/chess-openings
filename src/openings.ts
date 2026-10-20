import { Chess } from 'chess.js'
import rows from './data/openings.json'

export interface Opening {
  id: number
  eco: string
  name: string
  family: string
  moves: string[]
  epd: string
}

export const openings: Opening[] = (rows as [string, string, string, string][]).map(
  ([eco, name, moves, epd], id) => ({
    id,
    eco,
    name,
    family: name.split(':')[0],
    moves: moves.split(' '),
    epd,
  }),
)

const byPosition = new Map<string, Opening[]>()
for (const opening of openings) {
  const list = byPosition.get(opening.epd)
  if (list) list.push(opening)
  else byPosition.set(opening.epd, [opening])
}

const byName = new Map<string, Opening[]>()
for (const opening of openings) {
  const list = byName.get(opening.name)
  if (list) list.push(opening)
  else byName.set(opening.name, [opening])
}

export const names = [...byName.keys()]

// Several lines can share a name (e.g. "King's Pawn Game" is both 1. e4 and 1. e4 e5).
export function openingsNamed(name: string): Opening[] {
  return byName.get(name) ?? []
}

export function epd(fen: string) {
  return fen.split(' ').slice(0, 4).join(' ')
}

// Keyed by position rather than move order, so transpositions resolve to the same name.
export function openingsAt(fen: string): Opening[] {
  return byPosition.get(epd(fen)) ?? []
}

// Walks back from the end so play that has left the book still names where the book ended.
export function lastNamed(sans: string[]): { opening?: Opening; ply: number } {
  const replay = new Chess()
  const fens = [replay.fen()]
  for (const san of sans) {
    replay.move(san)
    fens.push(replay.fen())
  }
  for (let ply = sans.length; ply > 0; ply--) {
    const [opening] = openingsAt(fens[ply])
    if (opening) return { opening, ply }
  }
  return { ply: 0 }
}

// The position after each ply of a line, index 0 being the start.
export function positions(moves: string[]): string[] {
  const replay = new Chess()
  const out = [epd(replay.fen())]
  for (const san of moves) {
    replay.move(san)
    out.push(epd(replay.fen()))
  }
  return out
}

export function moveLabel(sans: string[], ply: number) {
  const number = Math.floor((ply - 1) / 2) + 1
  return ply % 2 ? `${number}. ${sans[ply - 1]}` : `${number}… ${sans[ply - 1]}`
}
