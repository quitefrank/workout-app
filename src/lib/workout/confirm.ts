/**
 * The words of the two action sheets that confirm a delete (Frank's call, 2026-11-13, from the HIG's Action sheets and
 * Modality pages: an intentional action that loses data gets an action sheet, with a save choice beside the destructive
 * one, as Mail's Delete Draft and Save Draft). Short titles, a message only where it adds something.
 */

const sets = (n: number) => `${n} ${n === 1 ? "set" : "sets"}`;

export type ExitAsk = { title: string; message: string; delete: string; complete: string };

/** Exit Workout Early: with nothing logged nothing is lost, so it exits without asking (null) */
export function exitAsk(loggedSets: number): ExitAsk | null {
  if (loggedSets <= 0) return null;
  return {
    title: "Exit Workout Early?",
    message: `${sets(loggedSets)} logged. Complete the workout to keep them.`,
    delete: "Delete Workout",
    complete: "Complete Workout",
  };
}

/** A finished workout's Delete */
export function deleteAsk(loggedSets: number): { title: string; message: string; delete: string } {
  return {
    title: "Delete Workout?",
    message: `${loggedSets > 0 ? `Its ${sets(loggedSets)} ${loggedSets === 1 ? "goes" : "go"} with it. ` : ""}This cannot be undone.`,
    delete: "Delete Workout",
  };
}
