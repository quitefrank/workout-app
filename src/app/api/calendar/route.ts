import { NextResponse, type NextRequest } from "next/server";
import { getWorkoutsBetween } from "@/lib/data/queries";
import { dotsByDay } from "@/lib/workout/calendar";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

/** The calendar's dots for a range. A read route and not a server action: actions run one at a time and hold up navigation, and the strip fetches while the selected day navigates. */
export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";
  const span = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (!DATE.test(from) || !DATE.test(to) || !(span >= 0 && span <= MAX_DAYS)) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD, at most a year apart" }, { status: 400 });
  }
  const workouts = await getWorkoutsBetween(from, to);
  return NextResponse.json({ days: dotsByDay(workouts, from, to) }, { headers: { "Cache-Control": "no-store" } });
}
