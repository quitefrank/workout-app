/**
 * The words of the action sheets that confirm a delete (Frank's calls, 2026-11-13, from the HIG's Action sheets,
 * Alerts and Modality pages: an intentional action that loses data gets an action sheet, with a save choice beside the
 * destructive one, as Mail's Delete Draft and Save Draft; one that cannot be undone always asks, even with nothing
 * logged, since a workout's time or an exercise's place goes with it). Short titles, a message only where it adds
 * something.
 */

const sets = (n: number) => `${n} ${n === 1 ? "set" : "sets"}`;

/** `complete` is null with nothing logged: there is nothing to keep */
export type ExitAsk = { title: string; message: string; delete: string; complete: string | null };

/** Exit Workout Early always asks; with sets logged it offers to complete the workout and keep them */
export function exitAsk(loggedSets: number): ExitAsk {
  if (loggedSets <= 0) {
    return { title: "Exit Workout Early?", message: "Nothing is logged yet. The workout and its time are deleted.", delete: "Delete Workout", complete: null };
  }
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

/** Remove, in a Journal card's More: always asks, since an exercise cannot be added back mid-workout */
export function removeAsk(name: string, loggedSets: number): { title: string; message: string; remove: string } {
  return {
    title: "Remove Exercise?",
    message:
      loggedSets > 0
        ? `${name} and its ${sets(loggedSets)} logged come out of this workout.`
        : `${name} comes out of this workout.`,
    remove: "Remove Exercise",
  };
}
