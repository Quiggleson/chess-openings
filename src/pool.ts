// Shuffled draws without repeats until every item has come up once, then a fresh shuffle.
export class Pool<T> {
  private queue: T[] = []
  private readonly items: () => T[]

  constructor(items: () => T[]) {
    this.items = items
  }

  next(): T | undefined {
    if (!this.queue.length) this.queue = shuffle(this.items())
    return this.queue.pop()
  }

  // Call when the items change (e.g. a filter), so stale picks don't linger in the queue.
  refill() {
    this.queue = []
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
