import Link from "next/link";
import { hueStyle, LargeTitle, Screen, SectionHeader, tileGradient } from "@/components/page";
import { cn } from "@/lib/cn";
import { listTemplates } from "@/lib/data/queries";
import { CATEGORY_LABELS } from "@/lib/workout/format";
import { groupByCategory } from "@/lib/workout/group";

export const metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const templates = await listTemplates();
  return (
    <Screen>
      <LargeTitle title="Templates" subtitle={`${templates.length} day templates`} />
      {groupByCategory(templates).map(([category, items]) => (
        <section key={category}>
          <SectionHeader title={CATEGORY_LABELS[category] ?? "Other"} />
          <div className="no-scrollbar flex snap-x gap-2.5 overflow-x-auto px-4 pb-1.5">
            {items.map((t) => (
              <Link
                key={t.id}
                href={`/templates/${t.id}`}
                style={hueStyle(t.category)}
                className={cn(
                  "relative aspect-[2/3] w-[132px] shrink-0 snap-start overflow-hidden rounded-xl text-white",
                  tileGradient,
                )}
              >
                <span className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.55),transparent_60%)]" />
                <span className="absolute left-2.5 top-2.5 right-2.5 text-[15px] font-semibold leading-tight">{t.name}</span>
                <span className="absolute bottom-1 left-2.5 text-[56px] font-extrabold leading-none tracking-[-0.04em] [text-shadow:0_2px_12px_rgba(0,0,0,0.4)]">
                  {t.variant ?? t.name.slice(0, 1)}
                </span>
                <span className="absolute bottom-3 right-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/85">
                  {t.exerciseCount} ex
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </Screen>
  );
}
