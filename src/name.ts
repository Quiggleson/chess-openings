import { Board } from './board'
import { renderMoves } from './moves'
import { names, openingsAt, type Opening } from './openings'
import type { Result } from './progress'
import { searcher } from './search'
import type { Session } from './session'
import { starButton } from './star'

const search = searcher(names)

// Moves → name. Shows a line's final position; any name for that position counts.
export function nameIt(root: HTMLElement, session: Session) {
  root.innerHTML = `
    <div class="layout">
      <div>
        <div class="board-wrap"><div class="board"></div></div>
        <div class="nav" role="group" aria-label="Step through the moves">
          <button type="button" class="secondary" data-step="start" aria-label="First position">⏮</button>
          <button type="button" class="secondary" data-step="back" aria-label="Previous move">◀</button>
          <button type="button" class="secondary" data-step="forward" aria-label="Next move">▶</button>
          <button type="button" class="secondary" data-step="end" aria-label="Final position">⏭</button>
          <button type="button" class="secondary" data-action="flip" aria-label="Flip board">⇅</button>
        </div>
      </div>
      <section class="panel">
        <div class="prompt-row">
          <p class="label">Name this opening</p>
        </div>
        <ol class="moves"></ol>
        <form class="answer" autocomplete="off">
          <input type="text" placeholder="Start typing a name…" aria-label="Opening name"
            role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="name-suggestions" />
          <ul id="name-suggestions" class="suggestions" role="listbox"></ul>
        </form>
        <p class="feedback" aria-live="polite"></p>
        <div class="buttons">
          <button type="button" data-action="give-up" class="secondary">Give up</button>
          <button type="button" data-action="easy" class="secondary" hidden>Easy</button>
          <button type="button" data-action="next" hidden>Next</button>
          <button type="button" data-action="all" class="secondary" hidden>Practice all openings</button>
        </div>
        <p class="keys">Keys: <kbd>←</kbd> <kbd>→</kbd> step · <kbd>F</kbd> flip · <kbd>/</kbd> answer · <kbd>E</kbd> easy · <kbd>*</kbd> star · <kbd>Enter</kbd> next</p>
      </section>
    </div>
  `
  const movesEl = root.querySelector<HTMLOListElement>('.moves')!
  const form = root.querySelector<HTMLFormElement>('.answer')!
  const input = form.querySelector<HTMLInputElement>('input')!
  const suggestionsEl = form.querySelector<HTMLUListElement>('.suggestions')!
  const feedbackEl = root.querySelector<HTMLElement>('.feedback')!
  const giveUpBtn = root.querySelector<HTMLButtonElement>('[data-action="give-up"]')!
  const nextBtn = root.querySelector<HTMLButtonElement>('[data-action="next"]')!
  const easyBtn = root.querySelector<HTMLButtonElement>('[data-action="easy"]')!
  const allBtn = root.querySelector<HTMLButtonElement>('[data-action="all"]')!
  const star = starButton(session.deck)
  root.querySelector('.prompt-row')!.append(star.el)

  const board = new Board(root.querySelector<HTMLElement>('.board')!)
  board.setInteractive(false)

  let line: Opening | undefined
  let answers: Opening[] = []
  let ply = 0
  let tries = 0
  let done = false
  let suggestions: string[] = []
  let selected = 0

  root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((button) =>
    button.addEventListener('click', () => step(button.dataset.step!)),
  )
  root.querySelector('[data-action="flip"]')!.addEventListener('click', flip)
  giveUpBtn.addEventListener('click', () => finish('fail'))
  nextBtn.addEventListener('click', next)
  easyBtn.addEventListener('click', markEasy)
  allBtn.addEventListener('click', () => session.practiceAll())

  input.addEventListener('input', () => {
    suggestions = search(input.value)
    selected = 0
    renderSuggestions()
  })
  input.addEventListener('keydown', (event) => {
    // Escape with nothing to dismiss leaves the box, so the arrow keys step through moves again.
    if (event.key === 'Escape' && !suggestions.length) input.blur()
    if (!suggestions.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      selected = (selected + delta + suggestions.length) % suggestions.length
      renderSuggestions()
    } else if (event.key === 'Escape') {
      suggestions = []
      renderSuggestions()
    }
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (suggestions[selected]) guess(suggestions[selected])
  })

  function start() {
    line = session.nextName()
    tries = 0
    done = !line
    easyBtn.hidden = true
    allBtn.hidden = !!line
    if (!line) return empty()
    star.set(line.name, line.epd)
    answers = openingsAt(line.epd)
    board.orientation = 'white'
    input.value = ''
    input.disabled = false
    suggestions = []
    renderSuggestions()
    feedback('')
    giveUpBtn.hidden = false
    nextBtn.hidden = true
    nextBtn.textContent = 'Next'
    goTo(line.moves.length)
  }

  function empty() {
    star.set(undefined)
    answers = []
    board.reset()
    movesEl.replaceChildren()
    input.value = ''
    input.disabled = true
    suggestions = []
    renderSuggestions()
    feedback(session.emptyMessage('name'))
    giveUpBtn.hidden = true
    nextBtn.hidden = false
    nextBtn.textContent = 'Check again'
  }

  function markEasy() {
    if (easyBtn.hidden || !line) return
    easyBtn.hidden = true
    feedback(session.easy('name', line), 'ok')
  }

  function next() {
    start()
    input.focus({ preventScroll: true })
  }

  function guess(name: string) {
    if (done) return
    tries++
    input.value = ''
    suggestions = []
    renderSuggestions()
    if (answers.some((a) => a.name === name)) return finish(tries === 1 ? 'clean' : 'help')
    if (answers.some((a) => a.family === name.split(':')[0])) {
      feedback(`Close: right family, wrong variation. “${name}”`, 'warn')
    } else {
      feedback(`Not “${name}”. Try again.`, 'warn')
    }
  }

  function finish(result: Result) {
    if (!line) return
    done = true
    const review = session.finish('name', line, result)
    const answer = `${answers[0].name} (${answers[0].eco})`
    const others = [...new Set(answers.map((a) => a.name))].slice(1)
    const also = others.length ? ` Also known as: ${others.join('; ')}.` : ''
    const verdict = { clean: '✓ Correct', help: '✓ Got it', fail: 'It was' }[result]
    feedback(`${verdict}: ${answer}.${also} ${review}`.trim(), result === 'fail' ? undefined : 'ok')
    easyBtn.hidden = !(result === 'clean' && session.canEasy('name', line))
    input.disabled = true
    giveUpBtn.hidden = true
    nextBtn.hidden = false
    nextBtn.focus({ preventScroll: true })
  }

  function flip() {
    board.orientation = board.orientation === 'white' ? 'black' : 'white'
  }

  function step(where: string) {
    if (!line) return
    const last = line.moves.length
    const target = { start: 0, back: ply - 1, forward: ply + 1, end: last }[where] ?? ply
    goTo(Math.max(0, Math.min(last, target)))
  }

  function goTo(target: number) {
    if (!line) return
    ply = target
    board.load(line.moves, ply)
    renderMoves(movesEl, line.moves, ply, goTo)
  }

  function renderSuggestions() {
    input.setAttribute('aria-expanded', String(suggestions.length > 0))
    suggestionsEl.replaceChildren(
      ...suggestions.map((name, i) => {
        const li = document.createElement('li')
        li.id = `name-suggestion-${i}`
        li.role = 'option'
        li.textContent = name
        li.setAttribute('aria-selected', String(i === selected))
        // mousedown, not click: click would blur the input first and lose the selection.
        li.addEventListener('mousedown', (event) => {
          event.preventDefault()
          guess(name)
        })
        return li
      }),
    )
    if (suggestions.length) input.setAttribute('aria-activedescendant', `name-suggestion-${selected}`)
    else input.removeAttribute('aria-activedescendant')
  }

  function feedback(text: string, tone?: 'ok' | 'warn') {
    feedbackEl.textContent = text
    if (tone) feedbackEl.dataset.state = tone
    else delete feedbackEl.dataset.state
  }

  start()

  return {
    show() {
      board.redraw()
      if (!done) input.focus({ preventScroll: true })
    },
    restart: start,
    onKey(event: KeyboardEvent) {
      const steps: Record<string, string> = { ArrowLeft: 'back', ArrowRight: 'forward', Home: 'start', End: 'end' }
      if (steps[event.key]) {
        event.preventDefault()
        step(steps[event.key])
      } else if (event.key.toLowerCase() === 'f') {
        flip()
      } else if (event.key === '/' && !done) {
        event.preventDefault()
        input.focus()
      } else if (event.key.toLowerCase() === 'e') {
        markEasy()
      } else if (event.key === '*') {
        star.toggle()
      } else if ((event.key === 'Enter' || event.key.toLowerCase() === 'n') && done) {
        next()
      }
    },
  }
}
