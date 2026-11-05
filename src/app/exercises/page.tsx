import { redirect } from "next/navigation";

/** The Library is a section of Home now; this keeps an old link or home screen shortcut working. */
export default function ExercisesPage() {
  redirect("/");
}
