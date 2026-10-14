import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCircleLink } from "@/components/glass";
import { TopBar } from "@/components/top-bar";
import { ChevronLeft } from "@/components/icons";
import { hueStyle, Row, Screen, SectionHeader, tileGradient } from "@/components/page";
import { cn } from "@/lib/cn";
import { getSettings, getTemplate } from "@/lib/data/queries";
import { CATEGORY_LABELS, EQUIPMENT_LABELS, prescriptionParts } from "@/lib/workout/format";
import { StartTemplate } from "./start-template";
import { buttonLook } from "@/components/button";

export default async function TemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const [{ id }, { start }] = await Promise.all([params, searchParams]);
  const [template, settings] = await Promise.all([getTemplate(id), getSettings()]);
  if (!template) notFound();
  const hasMachines = template.rows.some((r) => r.exercises.machine_location);

  return (
    <Screen className="max-w-none">
      <TopBar
        edge="dim"
        spacer={false}
        leading={
          <GlassCircleLink href="/templates" label="Back">
            <ChevronLeft size={20} />
          </GlassCircleLink>
        }
      />
      <div style={hueStyle(template.category)} className={cn("relative overflow-hidden text-white", tileGradient)}>
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.3),transparent_25%,transparent_45%,rgba(0,0,0,0.6))]" />
        <div className="relative mx-auto max-w-[640px] px-4 pb-5" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}>
          <div aria-hidden className="h-11" />
          <div className="mt-16 text-[15px] font-medium text-white/70">
            {[CATEGORY_LABELS[template.category ?? ""], template.estimated_minutes && `${template.estimated_minutes} min`]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <h1 className="text-[34px] font-bold leading-[41px] tracking-[-0.01em]">{template.name}</h1>
          <div className="mt-5 flex items-center gap-3">
            <StartTemplate
              templateId={template.id}
              askLocation={hasMachines}
              defaultLocation={settings.default_machine_location}
              autoOpen={start === "1"}
            />
            {template.tutorial_url && (
              <a href={template.tutorial_url} target="_blank" rel="noreferrer" {...buttonLook("veil")}>
                Tutorial
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[640px]">
        {template.notes && <p className="px-4 pt-4 text-[15px] text-ink-2">{template.notes}</p>}
        <SectionHeader title={`${template.rows.length} Exercises`} />
        <div className="grouped mx-4">
          {template.rows.map((r, i) => (
            <Link key={r.id} href={`/exercises/${r.exercises.id}`} className="block active:bg-fill">
              <Row
                leading={<span className="tabular w-5 shrink-0 text-center text-[15px] text-ink-3">{i + 1}</span>}
                title={
                  <>
                    {r.exercises.name}
                    {r.variant && <span className="text-ink-2"> · {r.variant}</span>}
                  </>
                }
                subtitle={
                  [prescriptionParts(r).join(" · "), r.exercises.machine_location && cap(r.exercises.machine_location)]
                    .filter(Boolean)
                    .join(" · ") || EQUIPMENT_LABELS[r.exercises.equipment_type]
                }
                chevron
              />
              {r.notes && <p className="-mt-1.5 px-4 pb-2.5 pl-12 text-[13px] text-ink-2">{r.notes}</p>}
            </Link>
          ))}
        </div>
      </div>
    </Screen>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
