/**
 * Today on a program, for the program screen and the calendar's up
 * next card. Pure: the page passes in what it read.
 *
 * Recovery: the phase in force (see phaseInForce), the week by the
 * calendar counted straight from day 0, and the phase one week behind
 * that count. The second is shown, not chosen: a person who lost a week
 * (a fall, a delayed clearance) can see where the straight count and
 * the shifted one differ and set the phase by hand.
 *
 * Training: the next day in sequence.
 */

import { restrictionState } from "@/lib/recovery/state";
import { dayIndex, weekIndex } from "@/lib/recovery/dates";
import type { Clearance } from "@/lib/recovery/types";
import {
  nextInSequence,
  nextTemplates,
  phaseInForce,
  type Completion,
  type PhaseInForce,
  type ProgramPhase,
  type ProgramTemplate,
} from "./next";

export type ProgramToday =
  | {
      kind: "recovery";
      day: number | null;
      week: number | null;
      inForce: PhaseInForce;
      /** The phase one week behind the straight count, when it differs from the straight count's phase. */
      weekBehindPosition: number | null;
      logStale: boolean;
      rehab: ProgramTemplate[];
      lastRehab: Completion | null;
      next: ProgramTemplate | null;
    }
  | {
      kind: "training";
      inForce: PhaseInForce;
      next: ProgramTemplate | null;
      finished: boolean;
      last: Completion | null;
    };

export function programToday(input: {
  kind: "recovery" | "training";
  phases: ProgramPhase[];
  completions: Completion[];
  today: string;
  injuryDate: string | null;
  clearances: Clearance[];
  chosenPosition: number | null;
}): ProgramToday {
  if (input.kind === "training") {
    const chosen = input.phases.find((p) => p.position === input.chosenPosition) ?? null;
    if (chosen) {
      const s = nextTemplates(chosen, input.completions);
      return {
        kind: "training",
        inForce: { phase: chosen, reason: "chosen", calendarPosition: null, loggedPosition: null },
        next: s.next ?? chosen.templates[0] ?? null,
        finished: false,
        last: s.lastTraining,
      };
    }
    const step = nextInSequence(input.phases, input.completions);
    return {
      kind: "training",
      inForce: { phase: step.phase, reason: "start", calendarPosition: null, loggedPosition: null },
      next: step.template,
      finished: step.finished,
      last: step.last,
    };
  }

  const state = input.clearances.length ? restrictionState(input.clearances, input.today) : null;
  const day = input.injuryDate ? dayIndex(input.injuryDate, input.today) : null;
  const week = input.injuryDate ? weekIndex(input.injuryDate, input.today) : null;
  const inForce = phaseInForce(input.phases, {
    chosenPosition: input.chosenPosition,
    loggedPhaseId: state?.currentPhaseId ?? null,
    logStale: state?.isStale ?? false,
    week,
  });
  let weekBehindPosition: number | null = null;
  if (week !== null && week >= 1) {
    const behind = phaseInForce(input.phases, { chosenPosition: null, loggedPhaseId: null, logStale: false, week: week - 1 });
    if (behind.calendarPosition !== inForce.calendarPosition) weekBehindPosition = behind.calendarPosition;
  }
  const s = inForce.phase ? nextTemplates(inForce.phase, input.completions) : null;
  return {
    kind: "recovery",
    day,
    week,
    inForce,
    weekBehindPosition,
    logStale: state?.isStale ?? false,
    rehab: s?.rehab ?? [],
    lastRehab: s?.lastRehab ?? null,
    next: s?.next ?? null,
  };
}
