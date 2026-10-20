import { openings, type Opening } from './openings'

export interface Filter {
  family: string
  maxMoves: number
}

const KEY = 'chess-openings:filter'

export const LONGEST = Math.max(...openings.map(fullMoves))

export const families = [...new Set(openings.map((o) => o.family))].sort((a, b) => a.localeCompare(b))

export function fullMoves(opening: Opening) {
  return Math.ceil(opening.moves.length / 2)
}

export function matches(opening: Opening, filter: Filter) {
  return (!filter.family || opening.family === filter.family) && fullMoves(opening) <= filter.maxMoves
}

// Browser storage can be missing or throw (private windows, blocked site data); fall back to all.
export function loadFilter(): Filter {
  const all = { family: '', maxMoves: LONGEST }
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (saved && (saved.family === '' || families.includes(saved.family)) && saved.maxMoves >= 1) {
      return { family: saved.family, maxMoves: Math.min(saved.maxMoves, LONGEST) }
    }
  } catch {}
  return all
}

export function saveFilter(filter: Filter) {
  try {
    localStorage.setItem(KEY, JSON.stringify(filter))
  } catch {}
}
