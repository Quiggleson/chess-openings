import type { Mode, Result } from './progress'

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export interface Schedule {
  due: number
  // Days; 0 while the card is new or relearning after a miss.
  interval: number
  ease: number
  reps: number
  lapses: number
}

export interface Entry {
  name: string
  // The position the Name it card shows; a name can cover several lines.
  epd: string
  added: number
  cards: Record<Mode, Schedule & { before?: Schedule }>
}

const KEY = 'chess-openings:deck'
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const RELEARN_DELAY = MINUTE
// Anki's "learn ahead": a just-missed card may come back early rather than leave nothing to do.
export const LEARN_AHEAD = 20 * MINUTE

export const gradeFor: Record<Result, Grade> = { clean: 'good', help: 'hard', fail: 'again' }

// SM-2, the algorithm Anki grew from: a miss starts the card over, a pass multiplies its interval
// by the card's ease, and the grade nudges the ease itself.
export function schedule(card: Schedule, grade: Grade, now = Date.now()): Schedule {
  if (grade === 'again') {
    return {
      ...card,
      interval: 0,
      ease: Math.max(1.3, card.ease - 0.2),
      lapses: card.lapses + (card.reps ? 1 : 0),
      reps: card.reps + 1,
      due: now + RELEARN_DELAY,
    }
  }
  const { interval, ease } = card
  const next = {
    hard: { interval: Math.max(1, Math.round(interval * 1.2)), ease: ease - 0.15 },
    good: { interval: interval === 0 ? 1 : interval === 1 ? 3 : Math.round(interval * ease), ease },
    easy: { interval: interval === 0 ? 4 : Math.round(interval * ease * 1.3), ease: ease + 0.15 },
  }[grade]
  return {
    ...card,
    interval: next.interval,
    ease: Math.max(1.3, next.ease),
    reps: card.reps + 1,
    due: startOfDay(now) + next.interval * DAY,
  }
}

// Due dates land on local midnight, so "tomorrow" means tomorrow and not 24 hours from now.
function startOfDay(time: number) {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function newCard(now: number): Schedule {
  return { due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0 }
}

export class Deck {
  private entries = new Map<string, Entry>(load())
  private listeners: (() => void)[] = []

  // Several views mirror the deck (stars on both drills, tab counts, stats).
  subscribe(listener: () => void) {
    this.listeners.push(listener)
  }

  has(name: string) {
    return this.entries.has(name)
  }

  get(name: string) {
    return this.entries.get(name)
  }

  all() {
    return [...this.entries.values()]
  }

  toggle(name: string, epd: string) {
    if (this.entries.delete(name)) return this.save()
    const now = Date.now()
    this.entries.set(name, { name, epd, added: now, cards: { play: newCard(now), name: newCard(now) } })
    this.save()
  }

  remove(name: string) {
    this.entries.delete(name)
    this.save()
  }

  // Cards ready now, soonest-due first. Relearning cards count a little early (LEARN_AHEAD).
  due(mode: Mode, now = Date.now()) {
    return this.all()
      .filter(({ cards }) => cards[mode].due <= now || (cards[mode].interval === 0 && cards[mode].due <= now + LEARN_AHEAD))
      .sort((a, b) => a.cards[mode].due - b.cards[mode].due)
  }

  nextDue(mode: Mode) {
    return Math.min(...this.all().map(({ cards }) => cards[mode].due))
  }

  grade(name: string, mode: Mode, grade: Grade) {
    const entry = this.entries.get(name)
    if (!entry) return
    const { before: _, ...card } = entry.cards[mode]
    entry.cards[mode] = { ...schedule(card, grade), before: card }
    this.save()
    return entry.cards[mode]
  }

  // Re-grades the last answer as Easy, from the state before it was graded.
  easy(name: string, mode: Mode) {
    const entry = this.entries.get(name)
    const before = entry?.cards[mode].before
    if (!entry || !before) return
    entry.cards[mode] = { ...schedule(before, 'easy'), before }
    this.save()
    return entry.cards[mode]
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify([...this.entries]))
    } catch {}
    for (const listener of this.listeners) listener()
  }
}

function load(): [string, Entry][] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    // Skips anything malformed (hand-edited storage, an older format) instead of breaking the page.
    if (Array.isArray(saved)) return saved.filter(([, entry]) => entry?.cards?.play && entry?.cards?.name)
  } catch {}
  return []
}

// Same-day times count in minutes or hours; later ones in calendar days, matching how due dates
// land on midnight.
export function until(time: number, now = Date.now()) {
  const days = Math.round((startOfDay(time) - startOfDay(now)) / DAY)
  if (days >= 1) return days === 1 ? 'tomorrow' : `in ${days} days`
  const minutes = Math.round((time - now) / MINUTE)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `in ${minutes} min`
  return `in ${Math.round(minutes / 60)} h`
}
