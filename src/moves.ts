// Fills an <ol> with numbered move pairs. With `onPick`, each move is a button that jumps to the
// position after it, and `current` (a ply count) marks where the board is.
export function renderMoves(
  list: HTMLOListElement,
  sans: string[],
  current?: number,
  onPick?: (ply: number) => void,
) {
  const items: HTMLLIElement[] = []
  for (let i = 0; i < sans.length; i += 2) {
    const li = document.createElement('li')
    li.append(move(i), ' ')
    if (i + 1 < sans.length) li.append(move(i + 1))
    items.push(li)
  }
  list.replaceChildren(...items)

  function move(i: number) {
    const ply = i + 1
    if (!onPick) return sans[i]
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'move'
    button.textContent = sans[i]
    if (ply === current) button.setAttribute('aria-current', 'step')
    button.addEventListener('click', () => onPick(ply))
    return button
  }
}
