/**
 * What a programme puts in front of you today. Pure, no Supabase import.
 *
 * A recovery programme runs by phase: the phase in force comes from the
 * one you chose, else the clearance log while it is current, else the
 * calendar counted from the injury. Inside a phase, rehab templates are
 * kept apart from the training rotation, because neither the physio
 * sheet nor the handout says how often to do them; the app lists them
 * every day and never schedules them. The training templates rotate:
 * the next one is the template after the last one you completed.
 *
 * A training programme runs in sequence: weeks of ordered days, and the
 * next day is the one after the most recent day you completed.
 */

export type ProgramTemplate = { id: string; name: string; category: string | null };

export type ProgramPhase = {
  id: string;
  position: number;
  weekFrom: number;
  weekTo: number | null;
  /** In the order the phase lists them (template_phases.position). */
  templates: ProgramTemplate[];
};

export type Completion = { templateId: string; completedAt: string };

export type PhaseReason = "chosen" | "log" | "calendar" | "start";

export type PhaseInForce = {
  phase: ProgramPhase | null;
  reason: PhaseReason;
  /** The phase the calendar puts you in, when there is a calendar. */
  calendarPosition: number | null;
  /** The phase the clearance log last named, current or not. */
  loggedPosition: number | null;
};

function byPosition(phases: ProgramPhase[]): ProgramPhase[] {
  return [...phases].sort((a, b) => a.position - b.position);
}

function calendarPhase(phases: ProgramPhase[], week: number): ProgramPhase | null {
  return byPosition(phases).find((p) => week >= p.weekFrom && (p.weekTo === null || week < p.weekTo)) ?? null;
}

/**
 * @param week whole weeks since day 0, or null for a programme with no
 *   start date.
 */
export function phaseInForce(
  phases: ProgramPhase[],
  input: { chosenPosition: number | null; loggedPhaseId: string | null; logStale: boolean; week: number | null },
): PhaseInForce {
  const calendar = input.week === null ? null : calendarPhase(phases, input.week);
  const logged = phases.find((p) => p.id === input.loggedPhaseId) ?? null;
  const base = { calendarPosition: calendar?.position ?? null, loggedPosition: logged?.position ?? null };

  const chosen = phases.find((p) => p.position === input.chosenPosition) ?? null;
  if (chosen) return { phase: chosen, reason: "chosen", ...base };
  if (logged && !input.logStale) return { phase: logged, reason: "log", ...base };
  if (calendar) return { phase: calendar, reason: "calendar", ...base };
  return { phase: byPosition(phases)[0] ?? null, reason: "start", ...base };
}

function latest(completions: Completion[], ids: Set<string>): Completion | null {
  let out: Completion | null = null;
  for (const c of completions) {
    if (!ids.has(c.templateId)) continue;
    if (out === null || c.completedAt > out.completedAt) out = c;
  }
  return out;
}

export function isRehab(t: ProgramTemplate): boolean {
  return t.category === "rehab";
}

export type PhaseSuggestion = {
  /** Every rehab template in the phase; unscheduled, listed every day. */
  rehab: ProgramTemplate[];
  lastRehab: Completion | null;
  /** The next training template in the rotation, or null when the phase has none. */
  next: ProgramTemplate | null;
  lastTraining: Completion | null;
};

export function nextTemplates(phase: ProgramPhase, completions: Completion[]): PhaseSuggestion {
  const rehab = phase.templates.filter(isRehab);
  const training = phase.templates.filter((t) => !isRehab(t));
  const lastRehab = latest(completions, new Set(rehab.map((t) => t.id)));
  const lastTraining = latest(completions, new Set(training.map((t) => t.id)));
  let next: ProgramTemplate | null = training[0] ?? null;
  if (lastTraining) {
    const i = training.findIndex((t) => t.id === lastTraining.templateId);
    next = training[(i + 1) % training.length];
  }
  return { rehab, lastRehab, next, lastTraining };
}

export type SequenceStep = {
  template: ProgramTemplate | null;
  phase: ProgramPhase | null;
  finished: boolean;
  last: Completion | null;
};

export function nextInSequence(phases: ProgramPhase[], completions: Completion[]): SequenceStep {
  const steps = byPosition(phases).flatMap((phase) => phase.templates.map((template) => ({ phase, template })));
  const last = latest(completions, new Set(steps.map((s) => s.template.id)));
  if (!last) {
    const first = steps[0] ?? null;
    return { template: first?.template ?? null, phase: first?.phase ?? null, finished: false, last: null };
  }
  const i = steps.findIndex((s) => s.template.id === last.templateId);
  const step = steps[i + 1] ?? null;
  if (!step) return { template: null, phase: steps[i].phase, finished: true, last };
  return { template: step.template, phase: step.phase, finished: false, last };
}
