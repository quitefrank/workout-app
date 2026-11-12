import { redirect } from "next/navigation";

/** Templates became the Library tab's Workouts (2026-11-11); this keeps an old link or home screen shortcut working. */
export default function TemplatesPage() {
  redirect("/library");
}
