import counts from './data/popularity.json'
import { openingsNamed } from './openings'

const games = counts as Record<string, number>
const byName = new Map<string, number>()

// Games in the sampled Lichess dump that followed the line ending at this position.
export function gamesAt(epd: string) {
  return games[epd] ?? 0
}

// A name can cover several lines; its most-played one stands for it.
export function gamesNamed(name: string) {
  let count = byName.get(name)
  if (count === undefined) {
    count = Math.max(...openingsNamed(name).map((o) => gamesAt(o.epd)))
    byName.set(name, count)
  }
  return count
}
