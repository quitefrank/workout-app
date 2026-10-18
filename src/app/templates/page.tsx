import Link from "next/link";
import { hueStyle, LargeTitle, Row, Screen, SectionHeader, Thumb, tileGradient } from "@/components/page";
import { cn } from "@/lib/cn";
import {
  getActiveProgramId,
  listPrograms,
  listProgramTemplates,
  listTemplates,
  type ProgramTemplateTile,
  type TemplateSummary,
} from "@/lib/data/queries";
import { weeksLabel } from "@/lib/programs/label";
import { CATEGORY_LABELS } from "@/lib/workout/format";
import { groupByCategory } from "@/lib/workout/group";

export const metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const [templates, programs, activeId] = await Promise.all([listTemplates(), listPrograms(), getActiveProgramId()]);
  const recovery = programs.filter((p) => p.kind === "recovery");
  const recoveryTemplates = await Promise.all(recovery.map((p) => listProgramTemplates(p.id)));

  return (
    <Screen>
      <LargeTitle title="Templates" subtitle={`${templates.length} day templates`} />

      {programs.length > 0 && (
        <section>
          <SectionHeader title="Programs" />
          <div className="grouped mx-4">
            {programs.map((p) => (
              <Link key={p.id} href={`/programs/${p.id}`} className="block active:bg-fill">
                <Row
                  leading={<Thumb category={p.kind === "recovery" ? "rehab" : "full_body"} label={p.kind === "recovery" ? "R" : "P"} />}
                  title={p.name}
                  subtitle={[
                    p.id === activeId && "Following",
                    p.kind === "recovery" ? `${p.phaseCount} phases` : `${p.phaseCount} weeks`,
                    `${p.templateCount} templates`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  chevron
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {recovery.map((p, i) => {
        const tiles = recoveryTemplates[i];
        const clinic = tiles.filter((t) => t.category === "rehab" && !t.needs_signoff);
        const outside = tiles.filter((t) => t.category === "rehab" && t.needs_signoff);
        const strength = tiles.filter((t) => t.category !== "rehab");
        return (
          <section key={p.id}>
            <TileRow title="Rehab" subtitle="Your clinic's, by phase" items={clinic} />
            <TileRow title="Rehab, E3 Rehab" subtitle="Needs physio sign-off before use" items={outside} />
            <TileRow title="Recovery Strength" subtitle="In the boot" items={strength} />
          </section>
        );
      })}

      {groupByCategory(templates).map(([category, items]) => (
        <section key={category}>
          <SectionHeader title={CATEGORY_LABELS[category] ?? "Other"} />
          <Tiles items={items} />
        </section>
      ))}
    </Screen>
  );
}

function TileRow({ title, subtitle, items }: { title: string; subtitle: string; items: ProgramTemplateTile[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <SectionHeader title={title} />
      <p className="-mt-1 px-4 pb-2 text-[15px] text-ink-2">{subtitle}</p>
      <Tiles items={items} weeks />
    </>
  );
}

function Tiles({ items, weeks }: { items: (TemplateSummary & Partial<ProgramTemplateTile>)[]; weeks?: boolean }) {
  return (
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
            {tileLabel(t.variant ?? t.name.slice(0, 1))}
          </span>
          <span className="absolute bottom-3 right-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/85">
            {weeks && t.weekFrom !== undefined && !/^\d+-\d+$/.test(t.variant ?? "")
              ? weeksLabel(t.weekFrom, t.weekTo ?? null).replace(/^Weeks? /, "Wk ")
              : `${t.exerciseCount} ex`}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** The big tile label shrinks for the longer phase labels ("2-6", "8-12", "Test"). */
function tileLabel(v: string) {
  if (v.length > 3) return <span className="text-[30px]">{v}</span>;
  return v.length > 2 ? <span className="text-[40px]">{v}</span> : v;
}
