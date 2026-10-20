export type Mode = 'play' | 'name'
export type Result = 'clean' | 'help' | 'fail'

export interface Record {
  seen: number
  right: number
  streak: number
  last: Result
  at: number
}

type Store = { [mode in Mode]: { [key: string]: Record } }

const KEY = 'chess-openings:progress'

// Per-opening history. Play it is keyed by name and Name it by final position, the same things
// each drill accepts as an answer, so regenerating the data file doesn't orphan old records.
export class Progress {
  private store: Store = load()
  onChange: () => void = () => {}

  record(mode: Mode, key: string, result: Result) {
    const prev = this.store[mode][key]
    const right = result === 'clean'
    this.store[mode][key] = {
      seen: (prev?.seen ?? 0) + 1,
      right: (prev?.right ?? 0) + (right ? 1 : 0),
      streak: right ? (prev?.streak ?? 0) + 1 : 0,
      last: result,
      at: Date.now(),
    }
    this.save()
    this.onChange()
  }

  get(mode: Mode, key: string): Record | undefined {
    return this.store[mode][key]
  }

  entries(mode: Mode) {
    return Object.entries(this.store[mode])
  }

  // Missed last time and not since fixed: what the next-drill pick leans toward.
  isShaky(mode: Mode, key: string) {
    const record = this.store[mode][key]
    return !!record && record.last !== 'clean'
  }

  reset() {
    this.store = empty()
    this.save()
    this.onChange()
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.store))
    } catch {}
  }
}

function empty(): Store {
  return { play: {}, name: {} }
}

function load(): Store {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (saved?.play && saved?.name) return saved
  } catch {}
  return empty()
}
