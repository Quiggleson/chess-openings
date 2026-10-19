import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import type { Key } from 'chessground/types'
import { Chess, SQUARES, type Move } from 'chess.js'
import 'chessground/assets/chessground.base.css'
import 'chessground/assets/chessground.brown.css'
import 'chessground/assets/chessground.cburnett.css'

// chess.js owns the rules; chessground only draws and reports what the user dragged.
export class Board {
  readonly chess = new Chess()
  private readonly cg: Api
  onMove: (move: Move) => void = () => {}

  constructor(el: HTMLElement) {
    this.cg = Chessground(el, {
      movable: { free: false, showDests: true, events: { after: (from, to) => this.play(from, to) } },
      highlight: { lastMove: true, check: true },
    })
    this.sync()
  }

  reset() {
    this.chess.reset()
    this.sync()
  }

  undo() {
    this.chess.undo()
    this.sync()
  }

  history() {
    return this.chess.history()
  }

  private play(from: Key, to: Key) {
    // Openings never need underpromotion, so a pawn reaching the last rank always queens.
    const move = this.chess.move({ from, to, promotion: 'q' })
    this.sync()
    this.onMove(move)
  }

  private sync() {
    const last = this.chess.history({ verbose: true }).at(-1)
    const turn = this.chess.turn() === 'w' ? 'white' : 'black'
    this.cg.set({
      fen: this.chess.fen(),
      turnColor: turn,
      check: this.chess.inCheck(),
      lastMove: last ? [last.from, last.to] : undefined,
      movable: { color: turn, dests: this.dests() },
    })
  }

  private dests() {
    const dests = new Map<Key, Key[]>()
    for (const square of SQUARES) {
      const moves = this.chess.moves({ square, verbose: true })
      if (moves.length) dests.set(square, moves.map((m) => m.to))
    }
    return dests
  }
}
