interface Entry {
  name: string
  words: string[]
  letters: number
}

// Typing "sic naj" should find "Sicilian Defense: Najdorf Variation": each typed word has to start
// a different word of the name. Results rank by how much of the name the query covers, so the
// shortest (most general) names come first until the query gets specific.
export function searcher(names: string[]) {
  const entries: Entry[] = names.map((name) => {
    const words = normalize(name)
    return { name, words, letters: words.join('').length }
  })

  return function search(query: string, limit = 3): string[] {
    const terms = normalize(query)
    if (!terms.length) return []
    const scored: [Entry, number][] = []
    for (const entry of entries) {
      const covered = cover(terms, entry.words)
      if (covered) scored.push([entry, covered / entry.letters])
    }
    scored.sort(([a, x], [b, y]) => y - x || a.letters - b.letters || a.name.localeCompare(b.name))
    return scored.slice(0, limit).map(([entry]) => entry.name)
  }
}

// Letters covered when every term prefixes a distinct word, else 0. Greedy is fine at this scale.
function cover(terms: string[], words: string[]) {
  const used = new Set<number>()
  let letters = 0
  for (const term of terms) {
    const i = words.findIndex((word, i) => !used.has(i) && word.startsWith(term))
    if (i < 0) return 0
    used.add(i)
    letters += term.length
  }
  return letters
}

// Folds accents ("Sörensen") and punctuation ("King's", "Queen's") so typing either way matches.
function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/'/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}
