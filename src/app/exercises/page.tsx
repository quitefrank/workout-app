import { redirect } from "next/navigation";

/** Exercises live in the Library tab; this keeps an old link or home screen shortcut working. */
export default function ExercisesPage() {
  redirect("/library/exercises");
}
