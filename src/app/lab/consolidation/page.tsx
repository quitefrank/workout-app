import { BackButton } from "@/components/back-button";
import { LargeTitle, Screen } from "@/components/page";
import { db, userId } from "@/lib/supabase/server";
import { MEMBERS } from "./movements";
import { Prototype, type ProtoDay, type ProtoExercise, type ProtoRow, type ProtoSession } from "./prototype";

export const metadata = { title: "Consolidation" };

type RawExercise = { id: string; slug: string; name: string; equipment_type: string; has_floors: boolean };

/** Read-only: real program days and history for the prototype. It writes nothing. */
export default async function ConsolidationLab() {
  const sb = db();
  const { data: programs } = await sb.from("programs").select("id, name").eq("kind", "training").order("name");
  const days: ProtoDay[] = [];
  const seen = new Map<string, RawExercise>();
  for (const program of programs ?? []) {
    const { data: phases } = await sb
      .from("program_phases")
      .select("id")
      .eq("program_id", program.id)
      .order("position")
      .limit(1);
    if (!phases?.[0]) continue;
    const { data: links } = await sb
      .from("template_phases")
      .select("position, templates(id, name, template_exercises(id, position, variant, prescribed_sets_min, prescribed_sets_max, prescribed_reps_min, prescribed_reps_max, prescribed_rir_min, prescribed_rir_max, prescribed_seconds_min, prescribed_seconds_max, prescribed_rest_seconds, prescribed_rpe, warm_up_sets_min, warm_up_sets_max, exercises(id, slug, name, equipment_type, has_floors)))")
      .eq("phase_id", phases[0].id)
      .order("position");
    for (const link of (links ?? []) as unknown as { templates: { id: string; name: string; template_exercises: (ProtoRow["prescription"] & { id: string; position: number; variant: string | null; exercises: RawExercise })[] } }[]) {
      const rows = [...link.templates.template_exercises].sort((a, b) => a.position - b.position);
      rows.forEach((r) => seen.set(r.exercises.slug, r.exercises));
      days.push({
        id: link.templates.id,
        program: program.name.replace("Jeff Nippard, ", ""),
        name: link.templates.name,
        rows: rows.map((r) => ({ id: r.id, slug: r.exercises.slug, variant: r.variant, prescription: r })),
      });
    }
  }

  const { data: memberRows } = await sb
    .from("exercises")
    .select("id, slug, name, equipment_type, has_floors")
    .in("slug", Object.keys(MEMBERS));
  ((memberRows ?? []) as RawExercise[]).forEach((e) => seen.set(e.slug, e));
  const all = [...seen.values()];
  const bySlugId = new Map(all.map((e) => [e.id, e.slug]));

  const history: Record<string, ProtoSession[]> = {};
  const ids = all.map((e) => e.id);
  const { data: logs } = await sb
    .from("workout_exercises")
    .select("exercise_id, machine_location, workouts!inner(user_id, completed_at), sets(set_number, is_warm_up, is_drop_set, weight, reps)")
    .in("exercise_id", ids)
    .eq("workouts.user_id", userId())
    .not("workouts.completed_at", "is", null);
  for (const l of (logs ?? []) as unknown as { exercise_id: string; machine_location: string | null; workouts: { completed_at: string }; sets: { set_number: number; is_warm_up: boolean; is_drop_set: boolean; weight: number | null; reps: number | null }[] }[]) {
    if (!l.sets.length) continue;
    const slug = bySlugId.get(l.exercise_id)!;
    (history[slug] ??= []).push({
      at: l.workouts.completed_at,
      floor: l.machine_location,
      sets: [...l.sets]
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({ w: s.weight == null ? null : Number(s.weight), r: s.reps, warm: s.is_warm_up, drop: s.is_drop_set })),
    });
  }
  Object.values(history).forEach((h) => h.sort((a, b) => b.at.localeCompare(a.at)));

  const { data: alts } = await sb
    .from("exercise_alternates")
    .select("exercise_id, position, alternate_exercise_id, exercises!exercise_alternates_alternate_exercise_id_fkey(slug, name)")
    .in("exercise_id", ids)
    .order("position");
  const altsOf: Record<string, { slug: string; name: string }[]> = {};
  for (const a of (alts ?? []) as unknown as { exercise_id: string; exercises: { slug: string; name: string } }[]) {
    (altsOf[bySlugId.get(a.exercise_id)!] ??= []).push(a.exercises);
  }

  const exercises: Record<string, ProtoExercise> = Object.fromEntries(
    all.map((e) => [e.slug, { slug: e.slug, name: e.name.trim(), equipmentType: e.equipment_type, hasFloors: e.has_floors, history: history[e.slug] ?? [], alternates: altsOf[e.slug] ?? [] }]),
  );

  return (
    <Screen>
      <LargeTitle title="Consolidation" subtitle="Prototype with your real programs and history. Nothing here saves." leading={<BackButton label="Back" />} />
      <Prototype days={days} exercises={exercises} />
    </Screen>
  );
}
