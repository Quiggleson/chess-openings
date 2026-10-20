import { Board } from './board'
import { renderMoves } from './moves'
import { epd, lastNamed, moveLabel, openingsNamed, positions, type Opening } from './openings'
import type { Result } from './progress'
import { mainLine, type Session } from './session'
import { starButton } from './star'

interface Candidate {
  opening: Opening
  positions: string[]
}

const MISSES_BEFORE_ARROW = 3

// Name → moves. The user plays both sides; any line sharing the prompt's name counts.
export function playIt(root: HTMLElement, session: Session) {
  root.innerHTML = `
    <div class="layout">
      <div class="board-wrap"><div class="board"></div></div>
      <section class="panel">
        <div class="prompt-row">
          <div>
            <p class="label">Play this opening</p>
            <p class="name prompt"></p>
          </div>
        </div>
        <p class="feedback" aria-live="polite"></p>
        <ol class="moves"></ol>
        <div class="buttons">
          <button type="button" data-action="hint">Hint</button>
          <button type="button" data-action="show" class="secondary">Show me</button>
          <button type="button" data-action="undo" class="secondary" hidden>Undo</button>
          <button type="button" data-action="easy" class="secondary" hidden>Easy</button>
          <button type="button" data-action="next" hidden>Next</button>
          <button type="button" data-action="all" class="secondary" hidden>Practice all openings</button>
        </div>
        <p class="keys">Keys: <kbd>H</kbd> hint · <kbd>S</kbd> show me · <kbd>U</kbd> undo · <kbd>E</kbd> easy · <kbd>*</kbd> star · <kbd>Enter</kbd> next</p>
      </section>
    </div>
  `
  const promptEl = root.querySelector<HTMLElement>('.prompt')!
  const feedbackEl = root.querySelector<HTMLElement>('.feedback')!
  const movesEl = root.querySelector<HTMLOListElement>('.moves')!
  const button = (action: string) => root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!
  const [hintBtn, showBtn, undoBtn, easyBtn, nextBtn, allBtn] = ['hint', 'show', 'undo', 'easy', 'next', 'all'].map(
    button,
  )
  const star = starButton(session.deck)
  root.querySelector('.prompt-row')!.append(star.el)

  const board = new Board(root.querySelector<HTMLElement>('.board')!)

  let candidates: Candidate[] = []
  let state: 'drill' | 'showing' | 'done' | 'empty' = 'drill'
  let lineEnd = 0
  let misses = 0
  let hintLevel = 0
  let helped = false

  board.accept = () => {
    if (state !== 'drill') return true
    const ply = board.history().length
    const here = epd(board.chess.fen())
    const live = candidates.filter((c) => c.positions[ply] === here)
    if (!live.length) return false
    candidates = live
    return true
  }

  board.onReject = () => {
    misses++
    helped = true
    if (misses >= MISSES_BEFORE_ARROW) showHint(2)
    feedback(
      misses >= MISSES_BEFORE_ARROW ? 'Not that one. Follow the arrow.' : 'Not that one. Try again.',
      'warn',
    )
  }

  board.onMove = () => {
    if (state === 'drill') {
      misses = 0
      hintLevel = 0
      const ply = board.history().length
      if (candidates.some((c) => c.opening.moves.length === ply)) finish(helped ? 'help' : 'clean')
      else feedback(`${toMove()} to move.`)
    }
    render()
  }

  hintBtn.addEventListener('click', () => showHint(hintLevel + 1))
  showBtn.addEventListener('click', showMe)
  undoBtn.addEventListener('click', () => {
    if (board.history().length > lineEnd) board.undo()
    render()
  })
  nextBtn.addEventListener('click', start)
  easyBtn.addEventListener('click', markEasy)
  allBtn.addEventListener('click', () => session.practiceAll())

  function start() {
    const name = session.nextPlay()
    if (!name) return empty()
    star.set(name, mainLine(name).epd)
    candidates = openingsNamed(name).map((opening) => ({ opening, positions: positions(opening.moves) }))
    state = 'drill'
    misses = 0
    hintLevel = 0
    helped = false
    board.reset()
    board.setInteractive(true)
    promptEl.textContent = name
    feedback(`${toMove()} to move.`)
    render()
  }

  function empty() {
    state = 'empty'
    candidates = []
    star.set(undefined)
    board.reset()
    board.setInteractive(false)
    promptEl.textContent = 'Nothing to review'
    feedback(session.emptyMessage('play'))
    render()
  }

  function markEasy() {
    if (easyBtn.hidden) return
    easyBtn.hidden = true
    feedback(session.easy('play', candidates[0].opening), 'ok')
  }

  function showHint(level: number) {
    if (state !== 'drill') return
    const ply = board.history().length
    const [from, to] = board.squaresOf(candidates[0].opening.moves[ply])
    hintLevel = Math.min(level, 2)
    helped = true
    board.hint(hintLevel === 1 ? [{ orig: from, brush: 'green' }] : [{ orig: from, dest: to, brush: 'green' }])
  }

  async function showMe() {
    if (state !== 'drill') return
    state = 'showing'
    board.setInteractive(false)
    const { moves } = candidates[0].opening
    for (let ply = board.history().length; ply < moves.length; ply++) {
      await wait(450)
      board.playSan(moves[ply])
      render()
    }
    board.setInteractive(true)
    finish('fail')
  }

  function finish(result: Result) {
    state = 'done'
    lineEnd = board.history().length
    const opening = candidates[0].opening
    const review = session.finish('play', opening, result)
    const verdict = { clean: '✓ Correct', help: '✓ Done, with help', fail: '✗ Shown' }[result]
    const after = review || 'Keep playing to explore, or press Next.'
    feedback(`${verdict} · ${opening.eco}. ${after}`, result === 'clean' ? 'ok' : undefined)
    render()
    easyBtn.hidden = !(result === 'clean' && session.canEasy('play', opening))
  }

  function render() {
    const sans = board.history()
    const drilling = state === 'drill' || state === 'showing'
    hintBtn.hidden = showBtn.hidden = !drilling
    hintBtn.disabled = showBtn.disabled = state === 'showing'
    nextBtn.hidden = drilling
    nextBtn.textContent = state === 'empty' ? 'Check again' : 'Next'
    allBtn.hidden = state !== 'empty'
    if (state !== 'done') easyBtn.hidden = true
    undoBtn.hidden = state !== 'done' || sans.length <= lineEnd

    if (state === 'done' && sans.length > lineEnd) {
      const { opening, ply } = lastNamed(sans)
      const where = ply < sans.length ? ` · out of book after ${moveLabel(sans, ply)}` : ''
      feedback(`Now: ${opening?.name ?? 'out of book'}${opening ? ` (${opening.eco})` : ''}${where}`)
    }

    renderMoves(movesEl, sans)
  }

  function feedback(text: string, tone?: 'ok' | 'warn') {
    feedbackEl.textContent = text
    if (tone) feedbackEl.dataset.state = tone
    else delete feedbackEl.dataset.state
  }

  function toMove() {
    return board.chess.turn() === 'w' ? 'White' : 'Black'
  }

  start()

  return {
    show() {
      board.redraw()
    },
    restart: start,
    onKey(event: KeyboardEvent) {
      const key = event.key.toLowerCase()
      if (key === 'h') showHint(hintLevel + 1)
      else if (key === 's') showMe()
      else if ((key === 'u' || key === 'backspace') && !undoBtn.hidden) undoBtn.click()
      else if (key === 'e') markEasy()
      else if (key === '*') star.toggle()
      else if ((key === 'enter' || key === 'n') && (state === 'done' || state === 'empty')) start()
    },
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
