/** A phase's week range as the handout writes it: "Weeks 8-12", "Week 3", "Week 52+". Ends are the phase's week_from and week_to. */
export function weeksLabel(from: number, to: number | null): string {
  if (to === null) return `Week ${from}+`;
  return to - from === 1 ? `Week ${from}` : `Weeks ${from}-${to}`;
}
