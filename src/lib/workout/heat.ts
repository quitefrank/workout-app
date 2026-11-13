/**
 * Home's Last 7 Days: working sets per muscle group over a window, scored against the evidence baseline (ACSM 2026:
 * at least 10 sets a muscle a week, diminishing returns past about 20). Modelled on Fitbod's recovery map, with Frank's
 * calls of 2026-11-11: stepped fading (an honest count, a set drops out when it leaves the window, no decay weighting),
 * a lift's main group counts each working set as 1 and its secondary groups as 0.5 (Pelland 2025, the paper's ref 187),
 * and the window is a rolling seven days or Monday to Sunday, a setting. Pure, no Supabase import.
 */

export type HeatWindow = "rolling" | "week";

/** The baseline: below LOW is short, LOW to HIGH is the range, past HIGH is diminishing returns. */
export const HEAT_LOW = 10;
export const HEAT_HIGH = 20;
/** A secondary group's share of a working set. */
export const SECONDARY_SHARE = 0.5;

/** The muscle groups the drawing shows, in the list's order. Cardio, Stretches and Neck are not drawn as heat. */
export const HEAT_GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Forearms",
  "Abs",
  "Quadriceps",
  "Hamstrings",
  "Glutes",
  "Calves",
] as const;
export type HeatGroup = (typeof HEAT_GROUPS)[number];

/** The drawing's muscles (react-muscle-highlighter slugs) for each group. Anything unlisted stays the body colour. */
export const GROUP_BODY_SLUGS: Record<HeatGroup, string[]> = {
  Chest: ["chest"],
  Back: ["trapezius", "upper-back", "lower-back"],
  Shoulders: ["deltoids"],
  Biceps: ["biceps"],
  Triceps: ["triceps"],
  Forearms: ["forearm"],
  Abs: ["abs", "obliques"],
  Quadriceps: ["quadriceps"],
  Hamstrings: ["hamstring"],
  Glutes: ["gluteal"],
  Calves: ["calves"],
};

const isHeatGroup = (g: string | null | undefined): g is HeatGroup => !!g && (HEAT_GROUPS as readonly string[]).includes(g);

function toDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(day: string, n: number): string {
  const d = toDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
}

/** The window's first day: six days back for rolling (today is the seventh), else this week's Monday. */
export function windowStart(today: string, window: HeatWindow): string {
  if (window === "rolling") return addDays(today, -6);
  const dow = toDate(today).getUTCDay(); // 0 Sunday
  return addDays(today, -((dow + 6) % 7));
}

/**
 * Cardio counts no sets (Frank's call, 2026-11-13): the baseline is resistance sets and the ACSM paper gives no rate
 * for aerobic work, so a cardio exercise is listed under the muscles it works (its secondaries, migration 0034) with
 * its minutes, at a share of 0.
 */
export const CARDIO_GROUP = "Cardio";

/** One exercise in a completed workout: its working sets (warm-ups left out), its groups and its logged seconds. */
export type HeatExercise = { exerciseId: string; title: string; group: string | null; secondaries: string[]; sets: number; seconds?: number };
export type HeatWorkout = { day: string; exercises: HeatExercise[] };

/** Where a group's count came from: an exercise and its share per set (1 direct, 0.5 secondary, 0 cardio, with its seconds). */
export type HeatSource = { exerciseId: string; title: string; sets: number; share: number; seconds?: number };

export type Heat = {
  from: string;
  to: string;
  /** Fractional sets per drawn group. */
  sets: Partial<Record<HeatGroup, number>>;
  sources: Partial<Record<HeatGroup, HeatSource[]>>;
  workouts: number;
  /** Working sets logged, each counted once whatever it trains. */
  workingSets: number;
};

export function heatOf(workouts: HeatWorkout[], today: string, window: HeatWindow): Heat {
  const from = windowStart(today, window);
  const sets: Heat["sets"] = {};
  const sources: Heat["sources"] = {};
  let count = 0;
  let workingSets = 0;
  const add = (g: HeatGroup, e: HeatExercise, share: number) => {
    sets[g] = (sets[g] ?? 0) + e.sets * share;
    const list = (sources[g] ??= []);
    const same = list.find((s) => s.exerciseId === e.exerciseId && s.share === share);
    if (same) {
      same.sets += e.sets;
      if (share === 0) same.seconds = (same.seconds ?? 0) + (e.seconds ?? 0);
    } else list.push({ exerciseId: e.exerciseId, title: e.title, sets: e.sets, share, ...(share === 0 ? { seconds: e.seconds ?? 0 } : {}) });
  };
  for (const w of workouts) {
    if (w.day < from || w.day > today) continue;
    const cardio = (e: HeatExercise) => e.group === CARDIO_GROUP;
    const worked = w.exercises.filter((e) => e.sets > 0 || (cardio(e) && (e.seconds ?? 0) > 0));
    if (worked.length === 0) continue;
    count++;
    for (const e of worked) {
      workingSets += e.sets;
      if (cardio(e)) {
        for (const s of e.secondaries) if (isHeatGroup(s)) add(s, e, 0);
        continue;
      }
      if (isHeatGroup(e.group)) add(e.group, e, 1);
      for (const s of e.secondaries) if (isHeatGroup(s) && s !== e.group) add(s, e, SECONDARY_SHARE);
    }
  }
  for (const g of HEAT_GROUPS) sources[g]?.sort((a, b) => b.share - a.share || b.sets - a.sets);
  return { from, to: today, sets, sources, workouts: count, workingSets };
}

/**
 * How red a group is, 0 to 100 (percent of the red mixed into the body colour). A ramp: nothing at 0, 16% for the
 * first set rising to 66% just short of LOW, 70% at LOW rising to 100% at HIGH, and 100% past it. The jump at LOW
 * marks reaching the range.
 */
export function heatPercent(sets: number, low = HEAT_LOW, high = HEAT_HIGH): number {
  if (!(sets > 0)) return 0;
  if (sets < low) return 16 + 50 * (sets / low);
  if (sets <= high) return 70 + 30 * ((sets - low) / Math.max(1, high - low));
  return 100;
}

export type HeatState = "none" | "short" | "range" | "past";
export function heatState(sets: number, low = HEAT_LOW, high = HEAT_HIGH): HeatState {
  if (!(sets > 0)) return "none";
  return sets < low ? "short" : sets <= high ? "range" : "past";
}

/** Sets read as people say them: 7, 7.5. */
export function formatSets(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** The line under a tapped muscle's name. */
export function stateLine(sets: number, low = HEAT_LOW, high = HEAT_HIGH): string {
  switch (heatState(sets, low, high)) {
    case "none":
      return "Not trained";
    case "short":
      return `${formatSets(low - sets)} short of ${low}`;
    case "range":
      return "In range";
    case "past":
      return "Past the point of diminishing returns";
  }
}

/** The last day each drawn group was trained (directly), from workouts newest or oldest first. */
export function lastTrained(workouts: HeatWorkout[], today: string): Partial<Record<HeatGroup, string>> {
  const out: Partial<Record<HeatGroup, string>> = {};
  for (const w of workouts) {
    if (w.day > today) continue;
    for (const e of w.exercises) if (e.sets > 0 && isHeatGroup(e.group) && (!out[e.group] || out[e.group]! < w.day)) out[e.group] = w.day;
  }
  return out;
}

/** A workout to suggest when no program is followed: the one whose muscles have rested longest. */
export type RecommendCandidate = { id: string; name: string; category: string | null; groups: string[] };
export type Recommendation<T extends RecommendCandidate> = { template: T; group: HeatGroup; days: number | null };

/** Days past this count the same, so one long-ignored group does not decide alone. */
const REST_CAP = 14;

/**
 * Templates with at least one drawn group, not cardio, and not done today or yesterday, ranked by the mean days since
 * each of their groups was trained (capped at 14, never trained counting as the cap). The reason is the group that has
 * rested longest. `doneRecently` holds template ids.
 */
export function recommend<T extends RecommendCandidate>(
  templates: T[],
  last: Partial<Record<HeatGroup, string>>,
  today: string,
  doneRecently: Set<string>,
): Recommendation<T>[] {
  return templates
    .filter((t) => t.category !== "cardio" && !doneRecently.has(t.id))
    .map((t) => {
      const groups = [...new Set(t.groups.filter(isHeatGroup))];
      const rested = groups.map((g) => [g, last[g] ? daysBetween(last[g]!, today) : null] as const);
      const score = rested.reduce((a, [, d]) => a + Math.min(d ?? REST_CAP, REST_CAP), 0) / Math.max(1, rested.length);
      const top = [...rested].sort((a, b) => (b[1] ?? Infinity) - (a[1] ?? Infinity))[0];
      return { t, score, top };
    })
    .filter((r) => r.top)
    .sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name))
    .map((r) => ({ template: r.t, group: r.top![0], days: r.top![1] }));
}

/** "Glutes last trained 3 days ago" */
export function recommendReason(group: string, days: number | null): string {
  if (days === null) return `${group} not trained in two months`;
  if (days > REST_CAP) return `${group} last trained over two weeks ago`;
  if (days === 0) return `${group} last trained today`;
  if (days === 1) return `${group} last trained yesterday`;
  return `${group} last trained ${days} days ago`;
}
