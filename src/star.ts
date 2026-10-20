import type { Deck } from './deck'

// The ☆ toggle on each drill. It names the deck, not the opening, so it never gives away a
// Name it answer.
export function starButton(deck: Deck) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'star'
  let current: { name: string; epd: string } | undefined

  el.addEventListener('click', () => {
    if (current) deck.toggle(current.name, current.epd)
  })
  deck.subscribe(render)

  function render() {
    el.hidden = !current
    const starred = !!current && deck.has(current.name)
    el.textContent = starred ? '★ In deck' : '☆ Add to deck'
    el.setAttribute('aria-pressed', String(starred))
  }

  return {
    el,
    set(name?: string, epd?: string) {
      current = name && epd ? { name, epd } : undefined
      render()
    },
    toggle() {
      el.click()
    },
  }
}
