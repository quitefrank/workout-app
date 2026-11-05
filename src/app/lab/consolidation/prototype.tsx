"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/button";
import { CheckIcon, ChevronDown, ChevronUpDown, HashIcon, DumbbellIcon, PlusIcon } from "@/components/icons";
import { Row, SectionHeader } from "@/components/page";
import { PrescriptionLine } from "@/components/prescription-line";
import { Sheet } from "@/components/sheet";
import { cn } from "@/lib/cn";
import { dayLabel, localDate } from "@/lib/workout/dates";
import { formatNumber, type Prescription } from "@/lib/workout/format";
import { FLOORS } from "@/lib/workout/machine-location";
import { MEMBERS, type Member } from "./movements";

type ProtoSet = { w: number | null; r: number | null; warm: boolean; drop: boolean };
export type ProtoSession = { at: string; floor: string | null; sets: ProtoSet[] };
export type ProtoExercise = { slug: string; name: string; equipmentType: string; hasFloors: boolean; history: ProtoSession[]; alternates: { slug: string; name: string }[] };
export type ProtoRow = { id: string; slug: string; variant: string | null; prescription: Prescription };
export type ProtoDay = { id: string; program: string; name: string; rows: ProtoRow[] };

type Mode = "today" | "consolidated";
type Tab = "library" | "program" | "workout";

const NONE = "Standard";

/** The rows of one movement, and what can be chosen on it. */
function membersOf(movement: string, exercises: Record<string, ProtoExercise>) {
  return Object.entries(MEMBERS)
    .filter(([slug, m]) => m.movement === movement && exercises[slug])
    .map(([slug, m]) => ({ slug, ...m }));
}

const equipmentOf = (movement: string, exercises: Record<string, ProtoExercise>) => [...new Set(membersOf(movement, exercises).map((m) => m.equipment))];
const variantsOf = (movement: string, equipment: string, exercises: Record<string, ProtoExercise>) => [
  ...new Set(membersOf(movement, exercises).filter((m) => m.equipment === equipment).map((m) => m.variant ?? NONE)),
];

/** History never mixes: one bucket per movement, equipment, variant and floor. */
function bucket(movement: string, equipment: string, variant: string, floor: string | null, exercises: Record<string, ProtoExercise>): ProtoSession[] {
  return membersOf(movement, exercises)
    .filter((m) => m.equipment === equipment && (m.variant ?? NONE) === variant)
    .flatMap((m) => exercises[m.slug].history)
    .filter((s) => floor === null || s.floor === null || s.floor === floor)
    .sort((a, b) => b.at.localeCompare(a.at));
}

const lineOf = (sets: ProtoSet[]) =>
  sets.map((s) => `${s.drop ? "D " : ""}${formatNumber(s.w) || "BW"}${s.r != null ? ` × ${s.r}` : ""}`).join(", ");

const when = (at: string) => dayLabel(localDate(new Date(at)));

function bestOf(sessions: ProtoSession[]) {
  let best: { w: number; r: number } | null = null;
  for (const s of sessions) {
    for (const x of s.sets) {
      if (x.warm || x.drop || x.w == null || !x.r) continue;
      if (!best || x.w > best.w || (x.w === best.w && x.r > best.r)) best = { w: x.w, r: x.r };
    }
  }
  return best;
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full bg-fill p-0.5">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("h-8 flex-1 rounded-full text-[13px] font-medium", value === v && "bg-[var(--seg-on)] font-semibold shadow-[var(--seg-shadow)]")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** A value set with the kit's pop-up button, as Floor is: painted face, invisible select on top. */
function PopUp({ label, value, options, onChange }: { label: string; value: string; options: readonly { value: string; label: string }[] | readonly string[]; onChange: (v: string) => void }) {
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div className="relative flex h-11 items-center justify-between gap-3">
      <span className="shrink-0 text-[15px] text-ink-2">{label}</span>
      <span aria-hidden className="flex min-w-0 items-center gap-1 text-[15px] font-medium text-blue">
        <span className="truncate">{items.find((i) => i.value === value)?.label ?? value}</span>
        <ChevronUpDown size={14} strokeWidth={2.2} className="shrink-0" />
      </span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0">
        {items.map((i) => (
          <option key={i.value} value={i.value}>
            {i.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Prototype({ days, exercises }: { days: ProtoDay[]; exercises: Record<string, ProtoExercise> }) {
  const [mode, setMode] = useState<Mode>("consolidated");
  const [tab, setTab] = useState<Tab>("program");
  const programs = useMemo(() => [...new Set(days.map((d) => d.program))], [days]);
  const [program, setProgram] = useState(programs.find((p) => p.includes("Ultimate")) ?? programs[0]);
  const programDays = days.filter((d) => d.program === program);
  const mostChanged = (list: ProtoDay[]) => [...list].sort((a, b) => b.rows.filter((r) => MEMBERS[r.slug]).length - a.rows.filter((r) => MEMBERS[r.slug]).length)[0]?.id ?? "";
  const [dayId, setDayId] = useState(mostChanged(programDays));
  const day = programDays.find((d) => d.id === dayId) ?? programDays[0];
  const [focus, setFocus] = useState<string | null>(null);

  return (
    <div className="pt-3">
      <div className="flex flex-col gap-2 px-4">
        <Segmented label="Model" value={mode} onChange={setMode} options={[["today", "Today"], ["consolidated", "Consolidated"]] as const} />
        <Segmented label="Screen" value={tab} onChange={setTab} options={[["library", "Library"], ["program", "Program Day"], ["workout", "Workout"]] as const} />
      </div>

      {tab === "library" && <LibraryView mode={mode} exercises={exercises} />}

      {tab !== "library" && (
        <div className="grouped mx-4 mt-3 px-4">
          <PopUp
            label="Program"
            value={program}
            options={programs}
            onChange={(p) => {
              setProgram(p);
              setDayId(mostChanged(days.filter((d) => d.program === p)));
              setFocus(null);
            }}
          />
          <PopUp label="Day" value={day?.id ?? ""} options={programDays.map((d) => ({ value: d.id, label: d.name }))} onChange={(d) => { setDayId(d); setFocus(null); }} />
        </div>
      )}

      {tab === "program" && day && (
        <ProgramView
          key={day.id}
          day={day}
          mode={mode}
          exercises={exercises}
          onOpen={(rowId) => {
            setFocus(rowId);
            setTab("workout");
          }}
        />
      )}
      {tab === "workout" && day && <WorkoutView key={`${day.id}-${mode}`} day={day} mode={mode} exercises={exercises} focus={focus} />}
    </div>
  );
}

function LibraryView({ mode, exercises }: { mode: Mode; exercises: Record<string, ProtoExercise> }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const rows = Object.keys(MEMBERS).filter((s) => exercises[s]);
  const movements = [...new Set(rows.map((s) => MEMBERS[s].movement))].sort();
  const needle = q.trim().toLowerCase();
  const todayList = rows.map((s) => exercises[s]).sort((a, b) => a.name.localeCompare(b.name)).filter((e) => e.name.toLowerCase().includes(needle));
  const movementList = movements.filter((m) => m.toLowerCase().includes(needle));
  return (
    <>
      <div className="px-4 pt-3">
        <input
          data-live
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search, try bench or curl"
          aria-label="Search exercises"
          className="h-11 w-full rounded-full bg-fill px-4 text-[17px] outline-none placeholder:text-ink-3"
        />
        <p className="px-1 pt-2 text-[13px] text-ink-2">
          {rows.length} rows become {movements.length} movements. These are the ones proposed so far; every other exercise stays as it is.
        </p>
      </div>
      <div className="grouped mx-4 mt-2">
        {mode === "today"
          ? todayList.map((e) => (
              <button key={e.slug} type="button" onClick={() => setOpen(e.slug)} className="block w-full text-left active:bg-fill">
                <Row title={e.name} subtitle={e.history.length ? `Logged in ${e.history.length} workouts` : "Never logged"} chevron />
              </button>
            ))
          : movementList.map((m) => {
              const logged = membersOf(m, exercises).reduce((n, x) => n + exercises[x.slug].history.length, 0);
              return (
                <button key={m} type="button" onClick={() => setOpen(m)} className="block w-full text-left active:bg-fill">
                  <Row title={m} subtitle={[equipmentOf(m, exercises).join(", "), logged ? `${logged} logged` : ""].filter(Boolean).join(" · ")} chevron />
                </button>
              );
            })}
      </div>
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={mode === "today" ? (open ? exercises[open]?.name ?? "" : "") : open ?? ""}>
        {open && (mode === "today" && exercises[open] ? <HistoryBlock sessions={exercises[open].history} /> : mode === "consolidated" ? <MovementSheet key={open} movement={open} exercises={exercises} /> : null)}
      </Sheet>
    </>
  );
}

function MovementSheet({ movement, exercises }: { movement: string; exercises: Record<string, ProtoExercise> }) {
  const options = equipmentOf(movement, exercises);
  const [equipment, setEquipment] = useState(options[0]);
  const variants = variantsOf(movement, equipment, exercises);
  const [variant, setVariant] = useState(variants[0]);
  const safeVariant = variants.includes(variant) ? variant : variants[0];
  return (
    <>
      <div className="grouped mb-3 px-4">
        <PopUp label="Equipment" value={equipment} options={options} onChange={setEquipment} />
        {variants.length > 1 && <PopUp label="Technique" value={safeVariant} options={variants} onChange={setVariant} />}
      </div>
      <HistoryBlock sessions={bucket(movement, equipment, safeVariant, null, exercises)} />
    </>
  );
}

function HistoryBlock({ sessions }: { sessions: ProtoSession[] }) {
  const best = bestOf(sessions);
  if (!sessions.length) return <p className="grouped mb-4 px-4 py-4 text-center text-[15px] text-ink-2">Nothing logged here yet</p>;
  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="grouped">
        <Row title="Workouts" value={sessions.length} />
        {best && <Row title="Heaviest" value={`${formatNumber(best.w)} × ${best.r}`} />}
      </div>
      <div className="grouped">
        {sessions.filter((s) => s.sets.some((x) => !x.warm)).slice(0, 5).map((s) => (
          <Row key={s.at} title={when(s.at)} subtitle={<span className="tabular">{lineOf(s.sets.filter((x) => !x.warm))}</span>} />
        ))}
      </div>
    </div>
  );
}

/** Alternates that are the same movement become equipment choices, so only the others stay alternates. */
function alternatesFor(slug: string, member: Member | undefined, exercises: Record<string, ProtoExercise>) {
  const all = exercises[slug]?.alternates ?? [];
  if (!member) return { kept: all, absorbed: [] as string[] };
  const absorbed = all.filter((a) => MEMBERS[a.slug]?.movement === member.movement).map((a) => MEMBERS[a.slug].equipment);
  return { kept: all.filter((a) => MEMBERS[a.slug]?.movement !== member.movement), absorbed };
}

function ProgramView({ day, mode, exercises, onOpen }: { day: ProtoDay; mode: Mode; exercises: Record<string, ProtoExercise>; onOpen: (rowId: string) => void }) {
  const changed = day.rows.filter((r) => MEMBERS[r.slug]).length;
  return (
    <>
      <SectionHeader title={day.name} />
      <p className="px-4 pb-2 text-[13px] text-ink-2">
        {mode === "consolidated" ? `${changed} of ${day.rows.length} rows become a movement. Doses and order don't change. Tap a row to log it.` : `${day.rows.length} rows, each its own exercise. Tap a row to log it.`}
      </p>
      <div className="grouped mx-4">
        {day.rows.map((r) => {
          const ex = exercises[r.slug];
          const member = MEMBERS[r.slug];
          const consolidated = mode === "consolidated" && member;
          const { kept, absorbed } = alternatesFor(r.slug, consolidated ? member : undefined, exercises);
          const options = consolidated ? equipmentOf(member.movement, exercises) : [];
          return (
            <button key={r.id} type="button" onClick={() => onOpen(r.id)} className="block w-full text-left active:bg-fill">
              <Row
                title={consolidated ? `${member.movement} · ${[member.equipment, member.variant].filter(Boolean).join(", ")}` : ex?.name}
                subtitle={
                  <span className="flex flex-col">
                    <span className="truncate">
                      <PrescriptionLine p={r.prescription} empty="No dose" />
                    </span>
                    {r.variant && <span className="truncate text-[13px]">{r.variant}</span>}
                    {consolidated && options.length > 1 && <span className="truncate text-[13px] text-blue">Can switch: {options.filter((o) => o !== member.equipment).join(", ")}</span>}
                    {kept.length > 0 && <span className="truncate text-[13px]">Alternates: {kept.map((a) => a.name).join(", ")}</span>}
                    {absorbed.length > 0 && <span className="sr-only">Replaces alternates {absorbed.join(", ")}</span>}
                  </span>
                }
                chevron
              />
            </button>
          );
        })}
      </div>
    </>
  );
}

function WorkoutView({ day, mode, exercises, focus }: { day: ProtoDay; mode: Mode; exercises: Record<string, ProtoExercise>; focus: string | null }) {
  const [open, setOpen] = useState<string | null>(focus ?? day.rows[0]?.id ?? null);
  return (
    <div className="mt-3 flex flex-col gap-2.5 px-4">
      {day.rows.map((r, i) => (
        <WorkoutCard key={r.id} index={i} row={r} mode={mode} exercises={exercises} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
      ))}
    </div>
  );
}

function WorkoutCard({ index, row, mode, exercises, open, onToggle }: { index: number; row: ProtoRow; mode: Mode; exercises: Record<string, ProtoExercise>; open: boolean; onToggle: () => void }) {
  const ex = exercises[row.slug];
  const member = MEMBERS[row.slug];
  const consolidated = mode === "consolidated" && Boolean(member);
  const movement = member?.movement ?? "";
  const options = consolidated ? equipmentOf(movement, exercises) : [];
  const [equipment, setEquipment] = useState(member?.equipment ?? "");
  const variants = consolidated ? variantsOf(movement, equipment, exercises) : [];
  const [variantPick, setVariantPick] = useState(member?.variant ?? NONE);
  const variant = variants.includes(variantPick) ? variantPick : (variants[0] ?? NONE);
  const twoFloors = consolidated ? membersOf(movement, exercises).some((m) => exercises[m.slug].hasFloors) && (equipment === "Machine" || equipment === "Cable") : ex?.hasFloors;
  const [floor, setFloor] = useState<string>(FLOORS[0].value);
  const [sets, setSets] = useState<ProtoSet[]>([]);
  const [drop, setDrop] = useState(false);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [moved, setMoved] = useState<string | null>(null);
  const history = consolidated ? bucket(movement, equipment, variant, twoFloors ? floor : null, exercises) : (ex?.history ?? []).filter((s) => !ex?.hasFloors || s.floor === null || s.floor === floor);
  const last = history.find((s) => s.sets.some((x) => !x.warm));
  const best = bestOf(history);
  const title = consolidated ? movement : ex?.name;
  const tag = consolidated ? [equipment, variant !== NONE ? variant : null].filter(Boolean).join(", ") : null;
  const newBest = sets.some((s) => !s.drop && s.w != null && s.r && (!best || s.w > best.w || (s.w === best.w && s.r > best.r)));

  const log = () => {
    const w = weight.trim() === "" ? null : Number(weight);
    const r = reps.trim() === "" ? null : Number(reps);
    if (w == null && r == null) return;
    setSets([...sets, { w, r, warm: false, drop }]);
    setReps("");
    setDrop(false);
  };
  const changeEquipment = (next: string) => {
    if (sets.length) setMoved(`Your ${sets.length} ${sets.length === 1 ? "set moved" : "sets moved"} to ${next}.`);
    setEquipment(next);
  };

  return (
    <section className="overflow-hidden rounded-[26px] bg-card">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className={cn("tabular grid size-8 shrink-0 place-items-center rounded-full text-[15px] font-semibold", sets.length ? "bg-green text-white" : "bg-fill text-ink-2")}>
          {sets.length ? <CheckIcon size={16} strokeWidth={2.6} /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold leading-[22px]">
            {title}
            {tag && <span className="ml-1.5 align-middle text-[13px] font-medium text-ink-2">{tag}</span>}
          </span>
          <span className="block truncate text-[15px] leading-5 text-ink-2">
            <PrescriptionLine p={row.prescription} empty="No prescription" />
          </span>
        </span>
        <ChevronDown size={18} className={cn("shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="px-4 pb-4">
          {row.variant && <p className="mb-1 text-[13px] text-ink-2">The program calls this: {row.variant}</p>}
          {options.length > 1 && <PopUp label="Equipment" value={equipment} options={options} onChange={changeEquipment} />}
          {variants.length > 1 && <PopUp label="Technique" value={variant} options={variants} onChange={setVariantPick} />}
          {twoFloors && <PopUp label="Floor" value={floor} options={FLOORS.map((f) => ({ value: f.value, label: f.label }))} onChange={setFloor} />}
          {consolidated && equipment !== member.equipment && <p className="mb-1 text-[13px] text-ink-2">This day prescribes {member.equipment}. Next week it starts there again.</p>}
          {moved && <p className="mb-1 text-[13px] text-ink-2">{moved}</p>}
          <p className="mb-2 mt-1 text-[13px] text-ink-2">
            {last ? (
              <>
                <span className="font-semibold">Last time{tag ? ` on ${equipment}` : ""}</span> · {when(last.at)}: <span className="tabular">{lineOf(last.sets.filter((s) => !s.warm))}</span>
              </>
            ) : (
              <span className="font-semibold">Nothing logged{tag ? ` on ${equipment}` : ""} yet</span>
            )}
            {best && <span className="block">Heaviest: <span className="tabular">{formatNumber(best.w)} × {best.r}</span></span>}
          </p>

          {sets.length > 0 && (
            <div className="mb-3 rounded-[18px] bg-bg/60 px-3.5 py-2">
              {sets.map((s, i) => (
                <div key={i} className="tabular flex h-8 items-center gap-2 text-[17px]">
                  <span className="w-7 text-[15px] text-ink-3">{s.drop ? `D${i + 1}` : i + 1}</span>
                  {formatNumber(s.w) || "BW"}
                  {s.r != null && <span className="text-ink-3">×</span>}
                  {s.r}
                </div>
              ))}
              {newBest && <p className="pt-1 text-[13px] font-semibold text-orange">New best{tag ? ` for ${tag}` : ""}</p>}
            </div>
          )}

          <div className="flex items-stretch gap-2">
            <Field icon={<DumbbellIcon size={12} />} label={ex?.equipmentType === "machine" ? "Weight" : "lbs"} value={weight} onChange={setWeight} decimal />
            <Field icon={<HashIcon size={12} />} label="Reps" value={reps} onChange={setReps} />
            <button type="button" onClick={log} aria-label="Log set" className="grid w-14 shrink-0 place-items-center rounded-2xl bg-blue text-white">
              <PlusIcon size={24} strokeWidth={2.4} />
            </button>
          </div>
          <div className="mt-2.5 flex justify-center">
            <Button small variant={drop ? "tinted" : "gray"} aria-pressed={drop} onClick={() => setDrop(!drop)}>
              Drop set
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ icon, label, value, onChange, decimal }: { icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; decimal?: boolean }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col rounded-2xl bg-fill px-3 py-1.5">
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-2">
        {icon}
        {label}
      </span>
      <input
        data-live
        type="number"
        inputMode={decimal ? "decimal" : "numeric"}
        step={decimal ? "any" : "1"}
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tabular w-full bg-transparent text-[22px] font-semibold outline-none"
      />
    </label>
  );
}
