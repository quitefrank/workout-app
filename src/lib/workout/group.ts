import { CATEGORY_ORDER } from "./format";

/** Items grouped by template category, in the app's category order; uncategorised last. */
export function groupByCategory<T extends { category: string | null }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const t of items) {
    const k = t.category ?? "other";
    map.set(k, [...(map.get(k) ?? []), t]);
  }
  const rank = (k: string) => {
    const i = CATEGORY_ORDER.indexOf(k);
    return i === -1 ? 99 : i;
  };
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
}
