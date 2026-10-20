import './style.css'
import { registerSW } from 'virtual:pwa-register'
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

  <div id="play"></div>

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

const play = playIt(document.querySelector<HTMLElement>('#play')!, score)
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return
  play.onKey(event)
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
