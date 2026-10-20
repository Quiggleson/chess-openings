// Session tally shared by both drills; only clean results count as right.
export class Score {
  right = 0
  total = 0
  onChange: () => void = () => {}

  record(right: boolean) {
    this.total++
    if (right) this.right++
    this.onChange()
  }
}
