import { NextResponse } from "next/server";
import { listExerciseItems } from "@/lib/exercise-items";

/** Every exercise for Library search, fetched when search opens so a day tap on Home never loads all 342. */
export async function GET() {
  return NextResponse.json({ items: await listExerciseItems() }, { headers: { "Cache-Control": "no-store" } });
}
