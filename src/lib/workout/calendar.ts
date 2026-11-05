import { shiftDate } from "./dates";

/** A workout as the calendar marks it. */
export type CalendarDot = { id: string; category: string | null; done: boolean };
/** Every day of a range, a day with no workouts holding an empty list: a day present here is a day known to be loaded. */
export type CalendarDots = Record<string, CalendarDot[]>;

/** The workouts of a range as dots by day, `from` to `to` inclusive. */
export function dotsByDay(
  workouts: { id: string; day: string; category: string | null; completedAt: string | null }[],
  from: string,
  to: string,
): CalendarDots {
  const days: CalendarDots = {};
  for (let d = from; d <= to; d = shiftDate(d, 1)) days[d] = [];
  for (const w of workouts) days[w.day]?.push({ id: w.id, category: w.category, done: !!w.completedAt });
  return days;
}
