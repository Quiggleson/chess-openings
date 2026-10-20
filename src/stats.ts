import { openingsAt } from './openings'
import type { Mode, Progress } from './progress'

const MODES: [Mode, string][] = [
  ['play', 'Play it'],
  ['name', 'Name it'],
]
const REVIEW_LIMIT = 10

interface Tally {
  seen: number
  right: number
}

export function stats(root: HTMLElement, progress: Progress) {
  root.innerHTML = `
    <div class="stats">
      <section class="panel">
        <p class="label">Overall</p>
        <dl class="totals"></dl>
      </section>
      <section class="panel">
        <p class="label">To review</p>
        <ul class="review"></ul>
      </section>
      <section class="panel wide">
        <p class="label">By family</p>
        <table class="families">
          <thead><tr><th>Family</th><th>Play it</th><th>Name it</th></tr></thead>
          <tbody></tbody>
        </table>
        <div class="buttons"><button type="button" class="secondary" data-action="reset">Reset progress</button></div>
      </section>
    </div>
  `
  const totalsEl = root.querySelector<HTMLElement>('.totals')!
  const reviewEl = root.querySelector<HTMLUListElement>('.review')!
  const familiesEl = root.querySelector<HTMLTableSectionElement>('.families tbody')!

  root.querySelector('[data-action="reset"]')!.addEventListener('click', () => {
    if (confirm('Clear all saved progress? This cannot be undone.')) progress.reset()
  })

  function render() {
    totalsEl.replaceChildren(
      ...MODES.flatMap(([mode, label]) => {
        const records = progress.entries(mode).map(([, r]) => r)
        const seen = records.reduce((n, r) => n + r.seen, 0)
        const right = records.reduce((n, r) => n + r.right, 0)
        const text = seen
          ? `${records.length} ${records.length === 1 ? 'opening' : 'openings'} · ${percent(right, seen)} right first time (${right}/${seen})`
          : 'Not started yet'
        return [el('dt', label), el('dd', text)]
      }),
    )

    const shaky = MODES.flatMap(([mode, label]) =>
      progress
        .entries(mode)
        .filter(([key]) => progress.isShaky(mode, key))
        .map(([key, record]) => ({ label, name: nameOf(mode, key), at: record.at })),
    )
      .sort((a, b) => b.at - a.at)
      .slice(0, REVIEW_LIMIT)
    reviewEl.replaceChildren(
      ...(shaky.length
        ? shaky.map(({ label, name }) => {
            const li = el('li', name)
            li.prepend(el('span', label, 'tag'))
            return li
          })
        : [el('li', 'Nothing missed recently.', 'muted')]),
    )

    const families = new Map<string, Record<Mode, Tally>>()
    for (const [mode] of MODES) {
      for (const [key, record] of progress.entries(mode)) {
        const family = nameOf(mode, key).split(':')[0]
        const row = families.get(family) ?? { play: { seen: 0, right: 0 }, name: { seen: 0, right: 0 } }
        row[mode].seen += record.seen
        row[mode].right += record.right
        families.set(family, row)
      }
    }
    const rows = [...families].sort(([, a], [, b]) => b.play.seen + b.name.seen - (a.play.seen + a.name.seen))
    familiesEl.replaceChildren(
      ...(rows.length
        ? rows.map(([family, row]) => {
            const tr = document.createElement('tr')
            tr.append(el('td', family), el('td', cell(row.play)), el('td', cell(row.name)))
            return tr
          })
        : [emptyRow()]),
    )
  }

  progress.onChange = render
  render()

  return {
    show: render,
    refill() {},
    onKey() {},
  }
}

function nameOf(mode: Mode, key: string) {
  return mode === 'play' ? key : (openingsAt(key)[0]?.name ?? 'Unknown position')
}

function cell({ seen, right }: Tally) {
  return seen ? `${percent(right, seen)} (${right}/${seen})` : '–'
}

function percent(part: number, whole: number) {
  return `${Math.round((100 * part) / whole)}%`
}

function emptyRow() {
  const tr = document.createElement('tr')
  const td = el('td', 'Finish a drill to see stats here.', 'muted')
  td.colSpan = 3
  tr.append(td)
  return tr
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text: string, className?: string) {
  const node = document.createElement(tag)
  node.textContent = text
  if (className) node.className = className
  return node
}
