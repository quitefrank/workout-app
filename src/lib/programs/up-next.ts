import { getActiveProgramId, getProgram, type ProgramDetail, type ProgramTemplateRow } from "@/lib/data/queries";
import { timeZone } from "@/lib/supabase/server";
import { localDate } from "@/lib/workout/dates";
import { programToday } from "./today";

export type NextTemplate = ProgramTemplateRow;

/** Where a program stands today, from its database row */
export function programTodayOf(program: ProgramDetail, today: string) {
  return programToday({
    kind: program.kind,
    phases: program.phases.map((p) => ({ id: p.id, position: p.position, weekFrom: p.week_from, weekTo: p.week_to, templates: p.templates })),
    completions: program.completions,
    today,
    injuryDate: program.recovery?.injuryDate ?? null,
    clearances: program.clearances,
    chosenPosition: program.chosenPhasePosition,
  });
}

/** The template the followed program runs next, or null when nothing is followed or the program has finished */
export async function getNextTemplate(): Promise<NextTemplate | null> {
  const activeId = await getActiveProgramId();
  const program = activeId ? await getProgram(activeId) : null;
  if (!program) return null;
  const id = programTodayOf(program, localDate(new Date(), timeZone())).next?.id;
  return program.phases.flatMap((p) => p.templates).find((t) => t.id === id) ?? null;
}
