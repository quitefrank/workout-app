import { NextResponse, type NextRequest } from "next/server";
import { getTemplate } from "@/lib/data/queries";
import { repTarget } from "@/lib/workout/active";
import { prescriptionFacts } from "@/lib/workout/format";
import { exerciseTitle } from "@/lib/workout/movements";

export type TemplatePreviewRow = { id: string; slug: string | null; title: string; target: string | null; dose: string };
export type TemplatePreview = { rows: TemplatePreviewRow[] };

/**
 * A workout's exercises for the dock sheet's preview step, worded as the workout page words them (the rep target before
 * the name, the warm-ups and sets under it). A read route, not a server action: actions run one at a time.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) return NextResponse.json({ error: "No such workout" }, { status: 404 });
  const rows: TemplatePreviewRow[] = template.rows.map((r) => ({
    id: r.id,
    slug: r.exercises.slug,
    title: exerciseTitle(r.exercises) + (r.variant ? ` · ${r.variant}` : ""),
    target: repTarget(r, { kind: "work", reps: null, seconds: null }),
    dose: prescriptionFacts(r)
      .filter((f) => f.kind === "warm" || f.kind === "sets")
      .map((f) => f.label)
      .join(" · "),
  }));
  return NextResponse.json({ rows } satisfies TemplatePreview, { headers: { "Cache-Control": "no-store" } });
}
