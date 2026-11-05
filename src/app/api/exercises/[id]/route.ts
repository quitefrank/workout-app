import { NextResponse, type NextRequest } from "next/server";
import { getExerciseView } from "@/lib/exercise-view";

/** One exercise for the sheet. A read route and not a server action: actions run one at a time and hold up navigation. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getExerciseView(id);
  if (!view) return NextResponse.json({ error: "No such exercise" }, { status: 404 });
  return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
}
