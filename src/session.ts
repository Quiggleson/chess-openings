import { Deck, gradeFor, until, type Entry } from './deck'
import { matches, type Filter } from './filter'
import { names, openings, openingsAt, openingsNamed, type Opening } from './openings'
import { Pool } from './pool'
import type { Mode, Progress, Result } from './progress'
import type { Score } from './score'

// What the drills draw from and where their results go: every opening (shuffled, leaning on
// recent misses) or only the cards due in the user's deck (spaced repetition).
export class Session {
  readonly deck = new Deck()
  private readonly score: Score
  private readonly progress: Progress
  private readonly filter: () => Filter
  private readonly playPool: Pool<string>
  private readonly namePool: Pool<Opening>
  private last: Partial<Record<Mode, string>> = {}
  // Set by the page: switches the filter back to every opening.
  practiceAll: () => void = () => {}

  constructor(score: Score, progress: Progress, filter: () => Filter) {
    this.score = score
    this.progress = progress
    this.filter = filter
    this.playPool = new Pool(
      () => names.filter((name) => openingsNamed(name).some((o) => this.include(o))),
      (name) => progress.isShaky('play', name),
    )
    this.namePool = new Pool(
      () => openings.filter((o) => this.include(o)),
      (line) => progress.isShaky('name', line.epd),
    )
  }

  get usingDeck() {
    return this.filter().source === 'deck'
  }

  include(opening: Opening) {
    return matches(opening, this.filter())
  }

  refill() {
    this.playPool.refill()
    this.namePool.refill()
  }

  nextPlay(): string | undefined {
    if (!this.usingDeck) return this.playPool.next()
    return this.pick('play')?.name
  }

  nextName(): Opening | undefined {
    if (!this.usingDeck) return this.namePool.next()
    const entry = this.pick('name')
    return entry && lineOf(entry)
  }

  // Cards due for this drill that pass the filter, soonest first.
  due(mode: Mode) {
    return this.deck.due(mode).filter((entry) => this.include(lineOf(entry)))
  }

  // Avoids serving the card just answered when anything else is due, so a miss isn't instant.
  private pick(mode: Mode) {
    const due = this.due(mode)
    const entry = due.find((e) => e.name !== this.last[mode]) ?? due[0]
    if (entry) this.last[mode] = entry.name
    return entry
  }

  // Records the result everywhere it counts; returns a note about the card's next review, if any.
  finish(mode: Mode, opening: Opening, result: Result): string {
    this.score.record(result === 'clean')
    this.progress.record(mode, mode === 'play' ? opening.name : opening.epd, result)
    if (!this.usingDeck) return ''
    const card = this.deck.grade(opening.name, mode, gradeFor[result])
    return card ? `Next review ${until(card.due)}.` : ''
  }

  canEasy(mode: Mode, opening: Opening) {
    return this.usingDeck && !!this.deck.get(opening.name)?.cards[mode].before
  }

  easy(mode: Mode, opening: Opening): string {
    const card = this.deck.easy(opening.name, mode)
    return card ? `Marked easy. Next review ${until(card.due)}.` : ''
  }

  emptyMessage(mode: Mode) {
    if (!this.deck.all().length) return 'Your deck is empty. Star ☆ openings while practicing all openings.'
    const later = this.deck.all().filter((entry) => this.include(lineOf(entry)))
    if (!later.length) return 'No openings in your deck match the filter.'
    const next = Math.min(...later.map((entry) => entry.cards[mode].due))
    return `All caught up. Next card ${until(next)}.`
  }
}

// The deck stores a name and a position; this finds the line that has both.
export function lineOf(entry: Entry): Opening {
  const here = openingsAt(entry.epd)
  return here.find((o) => o.name === entry.name) ?? here[0] ?? openingsNamed(entry.name)[0]
}

// The line a starred name's Name it card shows: its shortest, which is usually the main line.
export function mainLine(name: string): Opening {
  return openingsNamed(name).reduce((a, b) => (b.moves.length < a.moves.length ? b : a))
}
