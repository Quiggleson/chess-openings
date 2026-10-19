# Plan — chess openings trainer

A small, front-end-only personal tool for learning chess openings. Two drills:

1. **Play it** — given an opening's name, play its moves on the board.
2. **Name it** — given the position (and the moves that led there), type the opening's name.

This file is the working plan. Edit it as decisions change; settled decisions are at the bottom.

## Data

- **Source:** [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), CC0 (public
  domain). Five TSV files (`a.tsv`–`e.tsv`), columns `eco`, `name`, `pgn`.
- **Size:** 3,865 lines, 3,177 distinct names, 150 families (the part before the `:`, e.g.
  "Sicilian Defense"). Longest line is 54 plies. Raw TSV is ~400 KB; as JSON it should gzip to well
  under 100 KB.
- **Build step:** a script (`scripts/build-openings.ts`) downloads the TSVs once and writes
  `src/data/openings.json`, which is committed. Each entry is `[eco, name, moves, epd]`:
  - `moves`: space-separated SAN (`"e4 e5 f4"`)
  - `epd`: the final position (FEN without the move counters), for transposition lookups
  - `id` (array index) and `family` (the name before the `:`) are derived at load.
- **Position index:** `epd → [opening ids]`, built at load. This is what "name the current
  position" uses in both modes, so transpositions resolve to the right name no matter the move
  order.
- **Names aren't unique.** 308 names appear on more than one line (e.g. "King's Pawn Game" is both
  `1. e4` and `1. e4 e5`; "Italian Game: Classical Variation, Giuoco Pianissimo" has 17 lines). Both
  modes have to deal with this; see below.
- Precached by the service worker with the rest of the app, so it all works offline.

## Libraries

Still no UI framework (per CLAUDE.md). Two small dependencies:

- **[chess.js](https://github.com/jhlywa/chess.js)** (BSD-2): move legality, SAN, FEN. Not worth
  writing by hand.
- **Board:** see open question 1. Either [chessground](https://github.com/lichess-org/chessground)
  (Lichess's board: drag and click moves, arrows, highlights, animation; GPL-3) or
  [cm-chessboard](https://github.com/shaack/cm-chessboard) (MIT, simpler).

## Layout

- One screen with two tabs at the top: **Play it** / **Name it**.
- Board on the left (top on phones), panel on the right (below on phones): prompt, move list,
  feedback, buttons.
- Session score in the panel (`7 / 9 this session`).
- The pilot status panel goes away; the build version moves to a small footer line (CLAUDE.md
  wants it visible).

## Mode 1 — Play it (name → moves)

**Prompt:** the opening name, e.g. "Danish Gambit Accepted". The board starts at the initial
position.

**Playing the line:**

- The user plays **both sides**, one move at a time, until the line's last move. Then: success
  message, score +1.
- A correct move is accepted if it is the line's next move **or** reaches the same position as the
  line at that ply (so a move-order transposition that lands on the same position isn't punished).
- The move list fills in as they play (`1. e4 e5 2. d4 exd4 …`).

**Mistakes** (best judgment, easy to change):

- A wrong move snaps back, its squares flash red, and a mistake counter goes up. No penalty
  beyond that; they just try again.
- **Hint** button: highlights the piece to move. Second press: draws the arrow for the full move.
- After **3 mistakes on the same move**, the arrow appears on its own.
- **Show me** button: plays the rest of the line with animation and marks the drill as failed.
- Scoring: completed with no mistakes or hints = ✓; completed with help = "with help"; Show me
  = ✗. Only ✓ counts toward the session score.

**After the line ends (free play):**

- The board stays live. Every move after the line, the current position is looked up in the
  position index:
  - **In the book:** show its name (e.g. after "Danish Gambit Accepted", playing on with
    `4. Bc4 cxb2 5. Bxb2 d5` shows "Danish Gambit Accepted: Schlechter Defense").
  - **Out of book:** keep showing the last named position, marked "out of book after 6. …".
- An **Undo** button steps back one move in free play.
- This is what makes short lines like "King's Pawn Game" (`1. e4`) useful: play `1. e4` and keep
  going to see what each continuation is called.

**Duplicate names:** when several lines share the prompt's name, the drill accepts any of them. It
follows whichever line the user's moves match, and ends when one of them is complete.

**Next drill:** a **Next** button (and Enter key) picks a random opening from the current pool (see
open question 3). No repeats until the pool is used up.

## Mode 2 — Name it (moves → name)

**Prompt:** the board shows the line's **final position**, with the full move list beside it.

**Navigating moves:**

- Click any move in the list to jump to that position.
- ← / → step one ply, Home / End jump to the start or the final position. Buttons for the same on
  touch screens.
- The last move is highlighted on the board.

**Answering:**

- A text box. As the user types, the top **3** closest names from the full list (all 3,177) show
  below it. ↑/↓ + Enter or click to pick one. It's not multiple choice; all openings are always
  searchable.
- Matching: case- and punctuation-insensitive, and each typed word matches the start of a word
  in the name, so "sic naj" → "Sicilian Defense: Najdorf Variation". Ranked by how much of the
  name is covered, then by name length. Small hand-written scorer, no library.
- **Correct** if the chosen name belongs to *any* line whose final position is the same as the
  shown position. That handles both duplicate names and transpositions.
- **Close** if it's the right family but the wrong variation (e.g. "Sicilian Defense" for the
  Najdorf). Shown as close, not correct, with the right answer.
- **Wrong:** show it as wrong and let them try again. A **Give up** button shows the answer.
- After answering: show the full name and ECO code, then **Next**.

## Progress (later, optional)

- Per-opening history in `localStorage`: last result, streak, times seen.
- Weight the next-drill pick toward openings the user missed recently (simple spaced repetition).
- A small stats view: accuracy per family.

## Build order

1. **Data + core:** dataset script and JSON, chess.js, board component, position index. Board
   rendered on screen. ✅ Free-play board that names the current opening.
2. **Play it:** drill flow, mistakes and hints, free play with live names, Next.
3. **Name it:** final position, move navigation, fuzzy search, checking, Next.
4. **Polish:** tabs, session score, mobile layout, keyboard shortcuts, light/dark board colors.
5. **Progress** (optional): history, weighted picks, stats.

Each step is its own PR with a short preview note.

## Decisions

1. **Board library: chessground.** It's GPL-3, so the repo gets a GPL-3 `LICENSE` in build step 1.
   cm-chessboard (MIT) was the alternative.
2. **Play it: the user plays both sides.** "Play one side, app replies" is a possible later toggle.
3. **Pool: all 3,865 lines**, with a family filter and a max-length slider.
4. **Name it orientation: always from White's side**, with a flip button.
5. **"Close" stays** as its own result in Name it (right family, wrong variation).
