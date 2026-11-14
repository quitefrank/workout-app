/**
 * The words of the confirmations for a delete (Frank's calls, 2026-11-13, from the HIG's Action sheets, Alerts,
 * Popovers and Modality pages). A delete that cannot be undone always asks, even with nothing logged, since a workout's
 * time goes with it. One picked from a menu asks in a centred alert (Exit Workout Early), confirm or cancel; one from a button in the content asks in an action sheet grown from it (a finished
 * workout's Delete). Short titles, a message that says what goes, and a short verb that fits the alert's capsule.
 */

const sets = (n: number) => `${n} ${n === 1 ? "set" : "sets"}`;

export type Confirm = { title: string; message: string; action: string };

/** Exit Workout Early, from the workout's More menu: an alert */
export function exitAsk(loggedSets: number): Confirm {
  return {
    title: "Exit Workout Early?",
    message:
      loggedSets > 0
        ? `The workout and its ${sets(loggedSets)} logged are deleted. This cannot be undone.`
        : "Nothing is logged yet. The workout and its time are deleted.",
    action: "Delete",
  };
}

/** A finished workout's Delete, from the trash button: an action sheet */
export function deleteAsk(loggedSets: number): Confirm {
  return {
    title: "Delete Workout?",
    message: `${loggedSets > 0 ? `Its ${sets(loggedSets)} ${loggedSets === 1 ? "goes" : "go"} with it. ` : ""}This cannot be undone.`,
    action: "Delete Workout",
  };
}
