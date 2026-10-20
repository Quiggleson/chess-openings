const REVIEW_CHANCE = 1 / 3
// Draws between a miss and its review, so the answer isn't still fresh.
const REVIEW_GAP = 3

// Shuffled draws without repeats until every item has come up once, then a fresh shuffle. With
// `shaky`, about a third of draws instead revisit an item the user recently got wrong.
export class Pool<T> {
  private queue: T[] = []
  private recent: T[] = []
  private readonly items: () => T[]
  private readonly shaky: (item: T) => boolean

  constructor(items: () => T[], shaky: (item: T) => boolean = () => false) {
    this.items = items
    this.shaky = shaky
  }

  next(): T | undefined {
    const item = this.review() ?? this.draw()
    this.recent = [item!, ...this.recent].slice(0, REVIEW_GAP)
    return item
  }

  // Call when the items change (e.g. a filter), so stale picks don't linger in the queue.
  refill() {
    this.queue = []
  }

  private review() {
    if (Math.random() >= REVIEW_CHANCE) return undefined
    const due = this.items().filter((item) => this.shaky(item) && !this.recent.includes(item))
    if (!due.length) return undefined
    const item = due[Math.floor(Math.random() * due.length)]
    // Counts as this cycle's draw of it, so the shuffle doesn't serve it again right away.
    this.queue = this.queue.filter((queued) => queued !== item)
    return item
  }

  private draw() {
    if (!this.queue.length) this.queue = shuffle(this.items())
    return this.queue.pop()
  }
}

function shuffle<T>(items: T[]) {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
