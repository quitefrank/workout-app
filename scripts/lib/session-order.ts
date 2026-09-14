/**
 * Order a workout's Sessions rows the way Frank sees them in Notion.
 *
 * The Workouts page carries a relation (named "Name") to its Sessions
 * pages, listed newest-first. The order shown in Notion is that array
 * reversed. Rows that link to the workout but are missing from the
 * relation (older rows linked through the legacy "Workouts" relation,
 * or a relation the API truncated) go after, in the order they arrived.
 */
export function orderSessions<T extends { id: string }>(
  relationIds: readonly string[],
  rows: readonly T[],
): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) byId.set(row.id, row);

  const ordered: T[] = [];
  const placed = new Set<string>();
  for (let i = relationIds.length - 1; i >= 0; i--) {
    const id = relationIds[i];
    const row = byId.get(id);
    if (!row || placed.has(id)) continue;
    ordered.push(row);
    placed.add(id);
  }
  for (const row of rows) {
    if (placed.has(row.id)) continue;
    ordered.push(row);
    placed.add(row.id);
  }
  return ordered;
}
