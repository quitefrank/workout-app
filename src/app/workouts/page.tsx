import Link from "next/link";
import { GlassCircleLink } from "@/components/glass";
import { ChevronLeft } from "@/components/icons";
import { Chip, Empty, LargeTitle, Row, Screen, SectionHeader, Thumb } from "@/components/page";
import { getHistory, listTemplates } from "@/lib/data/queries";
import { dayLabel, durationMinutes, monthTitle } from "@/lib/workout/dates";

export const metadata = { title: "History" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template } = await searchParams;
  const [workouts, templates] = await Promise.all([getHistory(template ?? null), listTemplates()]);

  // Month sections, newest first
  const months: [string, typeof workouts][] = [];
  for (const w of workouts) {
    const key = w.day.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last[0] === key) last[1].push(w);
    else months.push([key, [w]]);
  }

  return (
    <Screen>
      <LargeTitle
        title="History"
        subtitle={`${workouts.length} completed`}
        leading={
          <GlassCircleLink href="/" label="Back to calendar">
            <ChevronLeft size={20} />
          </GlassCircleLink>
        }
      />
      <nav aria-label="Filter by template" className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip href="/workouts" on={!template}>
          All
        </Chip>
        {templates.map((t) => (
          <Chip key={t.id} href={`/workouts?template=${t.id}`} on={template === t.id}>
            {t.name}
          </Chip>
        ))}
      </nav>

      {months.length === 0 && (
        <div className="mt-6">
          <Empty title="No workouts yet" />
        </div>
      )}
      {months.map(([key, items]) => {
        const [y, m] = key.split("-").map(Number);
        return (
          <section key={key}>
            <SectionHeader title={y && m ? monthTitle({ year: y, month: m }) : "Undated"} />
            <div className="grouped mx-4">
              {items.map((w) => {
                const mins = durationMinutes(w.startedAt, w.completedAt);
                return (
                  <Link key={w.id} href={`/workouts/${w.id}/summary`} className="block active:bg-fill">
                    <Row
                      leading={<Thumb category={w.category} label={w.name.slice(0, 1)} />}
                      title={w.name}
                      subtitle={[w.day && dayLabel(w.day), `${w.exerciseCount} exercises`, mins && `${mins} min`]
                        .filter(Boolean)
                        .join(" · ")}
                      chevron
                    />
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </Screen>
  );
}
