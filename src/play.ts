import { Board } from './board'
import { renderMoves } from './moves'
import { epd, lastNamed, moveLabel, names, openingsNamed, positions, type Opening } from './openings'
import { Pool } from './pool'
import type { Score } from './score'

type Result = 'clean' | 'help' | 'fail'

interface Candidate {
  opening: Opening
  positions: string[]
}

const MISSES_BEFORE_ARROW = 3

// Name → moves. The user plays both sides; any line sharing the prompt's name counts.
export function playIt(root: HTMLElement, score: Score, include: (opening: Opening) => boolean) {
  root.innerHTML = `
    <div class="layout">
      <div class="board-wrap"><div class="board"></div></div>
      <section class="panel">
        <p class="label">Play this opening</p>
        <p class="name prompt"></p>
        <p class="feedback" aria-live="polite"></p>
        <ol class="moves"></ol>
        <div class="buttons">
          <button type="button" data-action="hint">Hint</button>
          <button type="button" data-action="show" class="secondary">Show me</button>
          <button type="button" data-action="undo" class="secondary" hidden>Undo</button>
          <button type="button" data-action="next" hidden>Next</button>
        </div>
        <p class="keys">Keys: <kbd>H</kbd> hint · <kbd>S</kbd> show me · <kbd>U</kbd> undo · <kbd>Enter</kbd> next</p>
      </section>
    </div>
  `
  const promptEl = root.querySelector<HTMLElement>('.prompt')!
  const feedbackEl = root.querySelector<HTMLElement>('.feedback')!
  const movesEl = root.querySelector<HTMLOListElement>('.moves')!
  const button = (action: string) => root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!
  const [hintBtn, showBtn, undoBtn, nextBtn] = ['hint', 'show', 'undo', 'next'].map(button)

  const board = new Board(root.querySelector<HTMLElement>('.board')!)
  const pool = new Pool(() => names.filter((name) => openingsNamed(name).some(include)))

  let candidates: Candidate[] = []
  let state: 'drill' | 'showing' | 'done' = 'drill'
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

  function start() {
    const name = pool.next()!
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
    score.record(result === 'clean')
    const opening = candidates[0].opening
    const verdict = { clean: '✓ Correct', help: '✓ Done, with help', fail: '✗ Shown' }[result]
    feedback(`${verdict} · ${opening.eco}. Keep playing to explore, or press Next.`, result === 'clean' ? 'ok' : undefined)
    render()
  }

  function render() {
    const sans = board.history()
    const drilling = state !== 'done'
    hintBtn.hidden = showBtn.hidden = !drilling
    hintBtn.disabled = showBtn.disabled = state === 'showing'
    nextBtn.hidden = drilling
    undoBtn.hidden = drilling || sans.length <= lineEnd

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
    refill() {
      pool.refill()
      start()
    },
    onKey(event: KeyboardEvent) {
      const key = event.key.toLowerCase()
      if (key === 'h') showHint(hintLevel + 1)
      else if (key === 's') showMe()
      else if ((key === 'u' || key === 'backspace') && !undoBtn.hidden) undoBtn.click()
      else if ((key === 'enter' || key === 'n') && state === 'done') start()
    },
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
