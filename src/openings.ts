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

export function epd(fen: string) {
  return fen.split(' ').slice(0, 4).join(' ')
}

// Keyed by position rather than move order, so transpositions resolve to the same name.
export function openingsAt(fen: string): Opening[] {
  return byPosition.get(epd(fen)) ?? []
}
