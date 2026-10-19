import './style.css'
import { registerSW } from 'virtual:pwa-register'
import { Chess } from 'chess.js'
import { Board } from './board'
import { openingsAt, type Opening } from './openings'

// Chromium-only and missing from TypeScript's DOM lib.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main>
  <h1>Chess Openings</h1>

  <div class="layout">
    <div class="board-wrap"><div id="board"></div></div>

    <section class="panel">
      <p class="label">Current opening</p>
      <p id="name" class="name"></p>
      <p id="eco" class="eco"></p>
      <ol id="moves" class="moves"></ol>
      <div class="buttons">
        <button id="undo" type="button">Undo</button>
        <button id="reset" type="button">Reset</button>
      </div>
    </section>
  </div>

  <footer>
    <a class="home" href="/">← quiggleson.com</a>
    <button id="install" type="button" hidden>Install app</button>
    <span id="ios-hint" class="hint" hidden>To install, tap Share, then <b>Add to Home Screen</b>.</span>
    <code class="version">${__APP_VERSION__}</code>
  </footer>
</main>
`

const nameEl = document.querySelector<HTMLElement>('#name')!
const ecoEl = document.querySelector<HTMLElement>('#eco')!
const movesEl = document.querySelector<HTMLOListElement>('#moves')!
const install = document.querySelector<HTMLButtonElement>('#install')!
const iosHint = document.querySelector<HTMLElement>('#ios-hint')!

const board = new Board(document.querySelector<HTMLElement>('#board')!)
board.onMove = render
document.querySelector('#undo')!.addEventListener('click', () => {
  board.undo()
  render()
})
document.querySelector('#reset')!.addEventListener('click', () => {
  board.reset()
  render()
})
render()

function render() {
  const sans = board.history()
  const { opening, ply } = lastNamed(sans)

  if (!sans.length) {
    nameEl.textContent = 'Starting position'
    ecoEl.textContent = 'Make a move to see its name.'
  } else if (!opening) {
    nameEl.textContent = 'Out of book'
    ecoEl.textContent = ''
  } else {
    nameEl.textContent = opening.name
    ecoEl.textContent =
      ply === sans.length ? opening.eco : `${opening.eco} · out of book after ${moveLabel(sans, ply)}`
  }

  movesEl.replaceChildren(
    ...pairs(sans).map(([white, black]) => {
      const li = document.createElement('li')
      li.textContent = black ? `${white} ${black}` : white
      return li
    }),
  )
}

// Walks back from the current position so out-of-book play still names where the book ended.
function lastNamed(sans: string[]): { opening?: Opening; ply: number } {
  const replay = new Chess()
  const fens = [replay.fen()]
  for (const san of sans) {
    replay.move(san)
    fens.push(replay.fen())
  }
  for (let ply = sans.length; ply > 0; ply--) {
    const [opening] = openingsAt(fens[ply])
    if (opening) return { opening, ply }
  }
  return { ply: 0 }
}

function moveLabel(sans: string[], ply: number) {
  const number = Math.floor((ply - 1) / 2) + 1
  return ply % 2 ? `${number}. ${sans[ply - 1]}` : `${number}… ${sans[ply - 1]}`
}

function pairs(sans: string[]) {
  const out: [string, string?][] = []
  for (let i = 0; i < sans.length; i += 2) out.push([sans[i], sans[i + 1]])
  return out
}

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
