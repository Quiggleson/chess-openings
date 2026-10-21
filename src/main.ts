import './style.css'
import { families, loadFilter, LONGEST, matches, saveFilter, type Filter } from './filter'
import { nameIt } from './name'
import { openings } from './openings'
import { playIt } from './play'
import { Progress } from './progress'
import { Score } from './score'
import { lineOf, Session } from './session'
import { stats } from './stats'
import { setupUpdates } from './updates'

// Chromium-only and missing from TypeScript's DOM lib.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main>
  <header>
    <h1>Chess Openings</h1>
    <p id="score" class="score"></p>
  </header>

  <nav class="tabs" role="tablist">
    <button type="button" role="tab" id="tab-play" aria-controls="play" aria-selected="true">
      Play it <span class="due" data-due="play" hidden></span>
    </button>
    <button type="button" role="tab" id="tab-name" aria-controls="name" aria-selected="false">
      Name it <span class="due" data-due="name" hidden></span>
    </button>
    <button type="button" role="tab" id="tab-stats" aria-controls="stats" aria-selected="false">Stats</button>
  </nav>

  <details class="filters">
    <summary id="filter-summary"></summary>
    <div class="filter-controls">
      <label>Practice
        <select id="source">
          <option value="all">All openings</option>
          <option value="deck">My deck (due cards)</option>
        </select>
      </label>
      <label id="order-label">Order
        <select id="order">
          <option value="random">Random</option>
          <option value="popular">Most popular first</option>
        </select>
      </label>
      <label>Family
        <select id="family">
          <option value="">All families</option>
          ${families.map((f) => `<option>${f}</option>`).join('')}
        </select>
      </label>
      <label>Up to <output id="max-out"></output> moves
        <input id="max" type="range" min="1" max="${LONGEST}" />
      </label>
      <span id="pool-count" class="count"></span>
    </div>
  </details>

  <div id="play" role="tabpanel" aria-labelledby="tab-play"></div>
  <div id="name" role="tabpanel" aria-labelledby="tab-name" hidden></div>
  <div id="stats" role="tabpanel" aria-labelledby="tab-stats" hidden></div>

  <footer>
    <a class="home" href="/">← quiggleson.com</a>
    <button id="install" type="button" hidden>Install app</button>
    <span id="ios-hint" class="hint" hidden>To install, tap Share, then <b>Add to Home Screen</b>.</span>
    <span class="update">
      <code id="version" class="version"></code>
      <button id="check-updates" type="button" class="link">Check for updates</button>
      <button id="clear-cache" type="button" class="link">Clear cache</button>
      <span id="update-status" class="muted" aria-live="polite"></span>
    </span>
  </footer>

  <div id="update-toast" class="toast" role="status" hidden>
    New version ready.
    <button id="update-reload" type="button">Reload</button>
  </div>
</main>
`

const install = document.querySelector<HTMLButtonElement>('#install')!
const iosHint = document.querySelector<HTMLElement>('#ios-hint')!
const scoreEl = document.querySelector<HTMLElement>('#score')!

const score = new Score()
score.onChange = () => {
  scoreEl.textContent = `${score.right} / ${score.total} this session`
}

const sourceSelect = document.querySelector<HTMLSelectElement>('#source')!
const orderSelect = document.querySelector<HTMLSelectElement>('#order')!
const orderLabel = document.querySelector<HTMLElement>('#order-label')!
const familySelect = document.querySelector<HTMLSelectElement>('#family')!
const maxInput = document.querySelector<HTMLInputElement>('#max')!
const maxOut = document.querySelector<HTMLOutputElement>('#max-out')!
const poolCount = document.querySelector<HTMLElement>('#pool-count')!
const filterSummary = document.querySelector<HTMLElement>('#filter-summary')!

let filter = loadFilter()
sourceSelect.value = filter.source
orderSelect.value = filter.order
familySelect.value = filter.family
maxInput.value = String(filter.maxMoves)

const progress = new Progress()
const session = new Session(score, progress, () => filter)
session.practiceAll = () => {
  sourceSelect.value = 'all'
  changeFilter()
}
const modes = {
  play: playIt(document.querySelector<HTMLElement>('#play')!, session),
  name: nameIt(document.querySelector<HTMLElement>('#name')!, session),
  stats: stats(document.querySelector<HTMLElement>('#stats')!, progress, session),
}
type Mode = keyof typeof modes
const TAB_KEY = 'chess-openings:tab'

for (const key of Object.keys(modes) as Mode[]) {
  document.querySelector(`#tab-${key}`)!.addEventListener('click', () => select(key))
}
let active: Mode = 'play'
select(savedTab())

function select(key: Mode) {
  active = key
  for (const other of Object.keys(modes) as Mode[]) {
    document.querySelector(`#tab-${other}`)!.setAttribute('aria-selected', String(other === key))
    document.querySelector<HTMLElement>(`#${other}`)!.hidden = other !== key
  }
  // The filter picks drills; it has nothing to say about stats.
  document.querySelector<HTMLElement>('.filters')!.hidden = key === 'stats'
  modes[key].show()
  try {
    localStorage.setItem(TAB_KEY, key)
  } catch {}
}

function savedTab(): Mode {
  try {
    const saved = localStorage.getItem(TAB_KEY)
    if (saved && saved in modes) return saved as Mode
  } catch {}
  return 'play'
}

renderFilter()
sourceSelect.addEventListener('change', changeFilter)
orderSelect.addEventListener('change', changeFilter)
familySelect.addEventListener('change', changeFilter)
maxInput.addEventListener('input', renderFilter)
maxInput.addEventListener('change', changeFilter)

function pendingFilter(): Filter {
  const source = sourceSelect.value === 'deck' ? 'deck' : 'all'
  const order = orderSelect.value === 'popular' ? 'popular' : 'random'
  return { source, order, family: familySelect.value, maxMoves: Number(maxInput.value) }
}

function changeFilter() {
  const next = pendingFilter()
  if (!openings.some((o) => matches(o, next))) {
    renderFilter()
    return
  }
  filter = next
  saveFilter(filter)
  renderFilter()
  session.refill()
  modes.play.restart()
  modes.name.restart()
}

// Shows what the controls would select while the slider is still moving, before it applies.
function renderFilter() {
  const pending = pendingFilter()
  maxOut.textContent = maxInput.value
  const count = openings.filter((o) => matches(o, pending)).length
  const inDeck = session.deck.all().filter((entry) => matches(lineOf(entry), pending)).length
  poolCount.textContent = !count
    ? 'No lines match; showing the previous set'
    : pending.source === 'deck'
      ? `${inDeck} of your ${session.deck.all().length} deck openings`
      : `${count.toLocaleString()} lines`
  poolCount.dataset.state = count ? '' : 'warn'
  const moves = filter.maxMoves < LONGEST ? `, up to ${filter.maxMoves} moves` : ''
  const source = filter.source === 'deck' ? 'my deck' : 'all openings'
  const popular = filter.source === 'all' && filter.order === 'popular' ? ', most popular first' : ''
  filterSummary.textContent = `Practice: ${source}${popular} · ${filter.family || 'all families'}${moves}`
  // The deck is always served soonest-due first, so Order only means something for all openings.
  orderLabel.hidden = pending.source === 'deck'
  renderDue()
}

// Due counts on the drill tabs, once there is a deck to count.
function renderDue() {
  const hasDeck = session.deck.all().length > 0
  for (const badge of document.querySelectorAll<HTMLElement>('[data-due]')) {
    const due = session.due(badge.dataset.due as 'play' | 'name').length
    badge.hidden = !hasDeck
    badge.textContent = String(due)
    badge.dataset.zero = String(due === 0)
    badge.title = `${due} due in your deck`
  }
}
session.deck.subscribe(renderFilter)
// Cards come due as time passes, not only when something is answered.
setInterval(renderDue, 60_000)

document.addEventListener('keydown', (event) => {
  const target = event.target
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return
  // Enter and Space on a focused button already click it.
  if (target instanceof HTMLButtonElement && (event.key === 'Enter' || event.key === ' ')) return
  modes[active].onKey(event)
})

setupUpdates({
  version: document.querySelector<HTMLElement>('#version')!,
  check: document.querySelector<HTMLButtonElement>('#check-updates')!,
  clear: document.querySelector<HTMLButtonElement>('#clear-cache')!,
  status: document.querySelector<HTMLElement>('#update-status')!,
  toast: document.querySelector<HTMLElement>('#update-toast')!,
  reload: document.querySelector<HTMLButtonElement>('#update-reload')!,
})

let installPrompt: BeforeInstallPromptEvent | null = null

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  installPrompt = event as BeforeInstallPromptEvent
  install.hidden = false
})

install.addEventListener('click', async () => {
  await installPrompt?.prompt()
  installPrompt = null
  install.hidden = true
})

window.addEventListener('appinstalled', () => {
  install.hidden = true
})

// iOS Safari never fires beforeinstallprompt; installing is a manual Share-sheet action.
const standalone = matchMedia('(display-mode: standalone)').matches
iosHint.hidden = standalone || !/iphone|ipad|ipod/i.test(navigator.userAgent)
