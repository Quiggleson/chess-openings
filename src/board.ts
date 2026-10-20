import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import type { DrawShape } from 'chessground/draw'
import type { Color, Key } from 'chessground/types'
import { Chess, SQUARES, type Move } from 'chess.js'
import 'chessground/assets/chessground.base.css'
import 'chessground/assets/chessground.brown.css'
import 'chessground/assets/chessground.cburnett.css'

// chess.js owns the rules; chessground only draws and reports what the user dragged.
export class Board {
  readonly chess = new Chess()
  private readonly cg: Api
  private interactive = true
  private hints: DrawShape[] = []
  private flashes: DrawShape[] = []
  private flashTimer = 0

  // Return false to refuse a move; the piece slides back and its squares flash red.
  accept: (move: Move) => boolean = () => true
  onMove: (move: Move) => void = () => {}
  onReject: (move: Move) => void = () => {}

  constructor(el: HTMLElement) {
    this.cg = Chessground(el, {
      movable: { free: false, showDests: true, events: { after: (from, to) => this.play(from, to) } },
      highlight: { lastMove: true, check: true },
      animation: { duration: 200 },
    })
    this.sync()
  }

  reset() {
    this.chess.reset()
    this.sync()
  }

  // Replays `sans` from the start and stops after `ply` of them, for stepping through a line.
  load(sans: string[], ply = sans.length) {
    this.chess.reset()
    for (const san of sans.slice(0, ply)) this.chess.move(san)
    this.sync()
  }

  undo() {
    this.chess.undo()
    this.sync()
  }

  playSan(san: string) {
    const move = this.chess.move(san)
    this.hints = []
    this.sync()
    return move
  }

  history() {
    return this.chess.history()
  }

  setInteractive(interactive: boolean) {
    this.interactive = interactive
    this.sync()
  }

  get orientation(): Color {
    return this.cg.state.orientation
  }

  set orientation(color: Color) {
    this.cg.set({ orientation: color })
  }

  // chessground measures its container once; call after showing a board that started hidden.
  redraw() {
    this.cg.redrawAll()
  }

  hint(shapes: DrawShape[]) {
    this.hints = shapes
    this.drawShapes()
  }

  // Square → move lookup for hints, since callers think in SAN.
  squaresOf(san: string): [Key, Key] {
    const move = new Chess(this.chess.fen()).move(san)
    return [move.from, move.to]
  }

  private play(from: Key, to: Key) {
    // Openings never need underpromotion, so a pawn reaching the last rank always queens.
    const move = this.chess.move({ from, to, promotion: 'q' })
    if (!this.accept(move)) {
      this.chess.undo()
      this.sync()
      this.flash([from, to])
      this.onReject(move)
      return
    }
    this.hints = []
    this.sync()
    this.onMove(move)
  }

  private flash(squares: Key[]) {
    clearTimeout(this.flashTimer)
    this.flashes = squares.map((orig) => ({ orig, brush: 'red' }))
    this.drawShapes()
    this.flashTimer = window.setTimeout(() => {
      this.flashes = []
      this.drawShapes()
    }, 700)
  }

  private drawShapes() {
    this.cg.setAutoShapes([...this.hints, ...this.flashes])
  }

  private sync() {
    const last = this.chess.history({ verbose: true }).at(-1)
    const turn = this.chess.turn() === 'w' ? 'white' : 'black'
    this.cg.set({
      fen: this.chess.fen(),
      turnColor: turn,
      check: this.chess.inCheck(),
      lastMove: last ? [last.from, last.to] : undefined,
      movable: { color: this.interactive ? turn : undefined, dests: this.dests() },
    })
    this.drawShapes()
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
