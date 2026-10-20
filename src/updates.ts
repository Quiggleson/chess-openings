import { registerSW } from 'virtual:pwa-register'

const VERSION_KEY = 'chess-openings:version'
const CHECK_EVERY = 30 * 60_000
// Coming back to the app is the natural moment to check, but not on every quick tab switch.
const MIN_GAP = 60_000

// Keeps an installed app current. A browser only checks for a new service worker on navigation,
// and an installed PWA left open may not navigate for days, so this also checks on resume and on
// a timer. A new version applies itself while the app is in the background; in the foreground it
// waits for the user, so a reload never lands mid-drill.
export function setupUpdates(els: {
  version: HTMLElement
  check: HTMLButtonElement
  clear: HTMLButtonElement
  status: HTMLElement
  toast: HTMLElement
  reload: HTMLButtonElement
}) {
  const sha = __APP_VERSION__.split(' ')[0]
  let registration: ServiceWorkerRegistration | undefined
  let lastCheck = 0
  let ready = false

  announceVersion()

  if (!('serviceWorker' in navigator)) {
    els.check.hidden = els.clear.hidden = true
    return
  }

  registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      registration = r
      setInterval(() => check(), CHECK_EVERY)
    },
    onNeedReload() {
      ready = true
      if (document.hidden) location.reload()
      else els.toast.hidden = false
    },
  })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ready) location.reload()
    else if (!document.hidden) check()
  })
  window.addEventListener('online', () => check())
  els.reload.addEventListener('click', () => location.reload())

  els.check.addEventListener('click', async () => {
    status('Checking…')
    const found = await check(true)
    if (!found) status('Up to date.', 2500)
    else status('Downloading the new version…')
  })

  els.clear.addEventListener('click', clearCache)

  // Resolves true when a newer version was found (it then installs and fires onNeedReload).
  async function check(force = false) {
    if (!registration || !navigator.onLine) return false
    if (!force && Date.now() - lastCheck < MIN_GAP) return false
    lastCheck = Date.now()
    try {
      await registration.update()
    } catch {
      return false
    }
    return !!(registration.installing || registration.waiting)
  }

  // Last resort when something looks stuck: drops this app's cached files and service worker, then
  // reloads from the network. Caches are per origin and shared with the rest of quiggleson.com, so
  // only the ones under this app's scope go. Saved progress lives in localStorage and stays.
  async function clearCache() {
    if (!confirm('Clear the cached app and reload? Your deck and progress are kept.')) return
    status('Clearing…')
    const scope = registration?.scope ?? new URL(import.meta.env.BASE_URL, location.href).href
    for (const name of await caches.keys()) {
      if (name.includes(scope)) await caches.delete(name)
    }
    await registration?.unregister()
    location.reload()
  }

  function status(text: string, clearAfter?: number) {
    els.status.textContent = text
    if (clearAfter) setTimeout(() => (els.status.textContent = ''), clearAfter)
  }

  // Tells the user when the build they are looking at changed since their last visit.
  function announceVersion() {
    els.version.textContent = __APP_VERSION__
    let previous: string | null = null
    try {
      previous = localStorage.getItem(VERSION_KEY)
      localStorage.setItem(VERSION_KEY, sha)
    } catch {}
    if (previous && previous !== sha) status(`Updated to ${sha}.`, 6000)
  }
}
