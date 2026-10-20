import './style.css'
import { registerSW } from 'virtual:pwa-register'
import { families, loadFilter, LONGEST, matches, saveFilter } from './filter'
import { nameIt } from './name'
import { openings, type Opening } from './openings'
import { playIt } from './play'
import { Score } from './score'

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
    <button type="button" role="tab" id="tab-play" aria-controls="play" aria-selected="true">Play it</button>
    <button type="button" role="tab" id="tab-name" aria-controls="name" aria-selected="false">Name it</button>
  </nav>

  <details class="filters">
    <summary id="filter-summary"></summary>
    <div class="filter-controls">
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

  <footer>
    <a class="home" href="/">← quiggleson.com</a>
    <button id="install" type="button" hidden>Install app</button>
    <span id="ios-hint" class="hint" hidden>To install, tap Share, then <b>Add to Home Screen</b>.</span>
    <code class="version">${__APP_VERSION__}</code>
  </footer>
</main>
`

const install = document.querySelector<HTMLButtonElement>('#install')!
const iosHint = document.querySelector<HTMLElement>('#ios-hint')!
const scoreEl = document.querySelector<HTMLElement>('#score')!

const score = new Score()
score.onChange = () => {
  scoreEl.textContent = `${score.right} / ${score.total} this session`
}

const familySelect = document.querySelector<HTMLSelectElement>('#family')!
const maxInput = document.querySelector<HTMLInputElement>('#max')!
const maxOut = document.querySelector<HTMLOutputElement>('#max-out')!
const poolCount = document.querySelector<HTMLElement>('#pool-count')!
const filterSummary = document.querySelector<HTMLElement>('#filter-summary')!

let filter = loadFilter()
familySelect.value = filter.family
maxInput.value = String(filter.maxMoves)
const include = (opening: Opening) => matches(opening, filter)

const modes = {
  play: playIt(document.querySelector<HTMLElement>('#play')!, score, include),
  name: nameIt(document.querySelector<HTMLElement>('#name')!, score, include),
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
familySelect.addEventListener('change', changeFilter)
maxInput.addEventListener('input', renderFilter)
maxInput.addEventListener('change', changeFilter)

function changeFilter() {
  const next = { family: familySelect.value, maxMoves: Number(maxInput.value) }
  if (!openings.some((o) => matches(o, next))) {
    renderFilter()
    return
  }
  filter = next
  saveFilter(filter)
  renderFilter()
  for (const mode of Object.values(modes)) mode.refill()
}

// Shows what the controls would select while the slider is still moving, before it applies.
function renderFilter() {
  const pending = { family: familySelect.value, maxMoves: Number(maxInput.value) }
  maxOut.textContent = maxInput.value
  const count = openings.filter((o) => matches(o, pending)).length
  poolCount.textContent = count ? `${count.toLocaleString()} lines` : 'No lines match; showing the previous set'
  poolCount.dataset.state = count ? '' : 'warn'
  const moves = filter.maxMoves < LONGEST ? `, up to ${filter.maxMoves} moves` : ''
  filterSummary.textContent = `Openings: ${filter.family || 'all families'}${moves}`
}

document.addEventListener('keydown', (event) => {
  const target = event.target
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return
  // Enter and Space on a focused button already click it.
  if (target instanceof HTMLButtonElement && (event.key === 'Enter' || event.key === ' ')) return
  modes[active].onKey(event)
})

if ('serviceWorker' in navigator) registerSW({ immediate: true })

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
