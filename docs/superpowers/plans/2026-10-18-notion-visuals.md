# Notion Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Notion Workout page's muscle diagrams and icons into the app: a muscle group card grid on Library, icon-labelled prescriptions, and workout type icons.

**Architecture:** A one-shot script traces Frank's three-tone Notion diagrams into SVG path data (`src/components/muscle-art/paths.ts`, generated and committed); a server-rendered `<MuscleArt>` fills those paths from theme tokens. Icons are redrawn in `icons.tsx`'s line style. Pure mapping helpers (`workoutIcon`, `prescriptionFacts`, `artFor`) carry the logic and the tests.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, sharp, potrace (npm, dev), @notionhq/client, Vitest, bun.

Spec: `docs/superpowers/specs/2026-10-18-notion-visuals-design.md`. House rules: no em dashes anywhere, Conventional Commits, every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File map

- Create `scripts/lib/muscle-tones.ts` (+ test): classify pixels into tones, flood-fill regions, build trace masks. Pure.
- Create `scripts/trace-muscle-art.ts`: download covers, derive the four extra groups, trace, write `paths.ts` and a preview.
- Create `scripts/types/potrace.d.ts`: types for the untyped package.
- Create `src/components/muscle-art/slug.ts`, `lookup.ts` (+ test), `paths.ts` (generated), `muscle-art.tsx`.
- Create `src/lib/workout/icons.ts` (+ test): category to icon name.
- Create `src/components/workout-icon.tsx`, `src/components/prescription-line.tsx`.
- Modify `src/components/icons.tsx` (export `IconProps`, ten icons), `src/components/page.tsx` (`Thumb`), `src/lib/workout/format.ts` (`prescriptionFacts`), `src/app/globals.css` (muscle tokens), `src/app/exercises/page.tsx`, `src/app/exercises/library.tsx`, `src/app/exercises/[id]/page.tsx`, `src/app/workouts/[id]/exercise-card.tsx`, `src/app/templates/[id]/page.tsx`, `src/app/templates/page.tsx`, `package.json`, `.gitignore`, `CLAUDE.md`.

---

### Task 1: Icons

**Files:**
- Modify: `src/components/icons.tsx`

- [ ] **Step 1: Export `IconProps`**

Change `type IconProps = SVGProps<SVGSVGElement> & { size?: number };` to:

```tsx
export type IconProps = SVGProps<SVGSVGElement> & { size?: number };
```

- [ ] **Step 2: Append the ten icons at the end of the file**

```tsx
/* Notion's column and workout icons, redrawn in this file's line style */

export const FlameIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.3-5.4 3.6-7.6.5 1.6 1.4 2.6 2.4 3.1.4-2.9 1.1-5.6 3.1-7.3.2 3 1.6 4.6 2.8 6.2 1 1.4 1.6 3 1.6 5 0 3.8-3 6.8-7 6.8Z" />
    <path d="M12 21c-1.7 0-3-1.2-3-2.9 0-1.6 1.2-2.6 2-3.8.8 1 1.6 1.5 2.4 2.3.9.8 1.6 1.5 1.6 2.4 0 1.2-1.3 2-3 2Z" />
  </Svg>
);

export const RepeatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M17 2.5l3 3-3 3" />
    <path d="M20 5.5H8.5A4.5 4.5 0 0 0 4 10v1" />
    <path d="M7 21.5l-3-3 3-3" />
    <path d="M4 18.5h11.5A4.5 4.5 0 0 0 20 14v-1" />
  </Svg>
);

export const HashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 3.5l-2 17M16.5 3.5l-2 17M4.5 8.5h16M3.5 15.5h16" />
  </Svg>
);

export const DumbbellIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="6.5" width="3.5" height="11" rx="1.2" />
    <rect x="15.5" y="6.5" width="3.5" height="11" rx="1.2" />
    <path d="M8.5 12h7M3 9.5v5M21 9.5v5" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const FigureIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="4.8" r="1.8" />
    <path d="M5 8.5c2.4.8 4.6 1.2 7 1.2s4.6-.4 7-1.2M12 9.7v4.8M12 14.5l-3 6M12 14.5l3 6" />
  </Svg>
);

export const HandIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V13" />
    <path d="M17 9a1.5 1.5 0 0 1 3 0v4.5a7.5 7.5 0 0 1-7.5 7.5h-.6a6.5 6.5 0 0 1-5.4-2.9l-2.6-3.8a1.5 1.5 0 0 1 2.4-1.8L8 14.5" />
  </Svg>
);

export const PantsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 3.5h11l1.5 17h-4.5L12 9.5l-2.5 11H5l1.5-17ZM6.5 7h11" />
  </Svg>
);

export const ShoeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 17.5v-8c0-.6.4-1 1-1h2.2c.5 0 .9.3 1 .8.4 1.4 1.6 2.2 3 2.2l2.6.5 4.5 1.4c1.8.6 3.2 2 3.2 3.6v.5H3ZM3 20.5h18M9.5 11.5l1-2M12.5 12l1-2" />
  </Svg>
);

export const ShirtIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 3.5c.4 1.4 1.6 2.3 3 2.3s2.6-.9 3-2.3l5 2.3-1.8 4.2-2.7-1v11.5H7.5V9l-2.7 1L3 5.8l6-2.3Z" />
  </Svg>
);
```

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/icons.tsx
git commit -m "feat: Notion's column and workout icons, redrawn as line icons"
```

---

### Task 2: Workout type icon mapping

**Files:**
- Create: `src/lib/workout/icons.ts`
- Create: `src/components/workout-icon.tsx`
- Test: `src/lib/workout/__tests__/icons.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { workoutIcon } from "../icons";

describe("workoutIcon", () => {
  it("follows Notion's workout page icons", () => {
    expect(workoutIcon("push")).toBe("hand");
    expect(workoutIcon("pull")).toBe("dumbbell");
    expect(workoutIcon("legs")).toBe("pants");
    expect(workoutIcon("full_body")).toBe("figure");
    expect(workoutIcon("cardio")).toBe("shoe");
    expect(workoutIcon("abs")).toBe("shirt");
  });

  it("gives the categories Notion never had an icon", () => {
    expect(workoutIcon("arms")).toBe("dumbbell");
    expect(workoutIcon("rehab")).toBe("figure");
  });

  it("falls back to the dumbbell", () => {
    expect(workoutIcon(null)).toBe("dumbbell");
    expect(workoutIcon(undefined)).toBe("dumbbell");
    expect(workoutIcon("something-new")).toBe("dumbbell");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `bun run test src/lib/workout/__tests__/icons.test.ts`
Expected: FAIL, cannot find module `../icons`.

- [ ] **Step 3: Implement**

`src/lib/workout/icons.ts`:

```ts
/** The icon a workout or template shows for its category, after Notion's workout page icons. */
export type WorkoutIconName = "hand" | "dumbbell" | "pants" | "figure" | "shoe" | "shirt";

const BY_CATEGORY: Record<string, WorkoutIconName> = {
  push: "hand",
  pull: "dumbbell",
  legs: "pants",
  full_body: "figure",
  cardio: "shoe",
  abs: "shirt",
  arms: "dumbbell",
  rehab: "figure",
};

export function workoutIcon(category: string | null | undefined): WorkoutIconName {
  return BY_CATEGORY[category ?? ""] ?? "dumbbell";
}
```

`src/components/workout-icon.tsx`:

```tsx
import { workoutIcon, type WorkoutIconName } from "@/lib/workout/icons";
import { DumbbellIcon, FigureIcon, HandIcon, PantsIcon, ShirtIcon, ShoeIcon, type IconProps } from "./icons";

const ICONS: Record<WorkoutIconName, (p: IconProps) => React.ReactNode> = {
  hand: HandIcon,
  dumbbell: DumbbellIcon,
  pants: PantsIcon,
  figure: FigureIcon,
  shoe: ShoeIcon,
  shirt: ShirtIcon,
};

export function WorkoutIcon({ category, ...p }: IconProps & { category: string | null | undefined }) {
  const Icon = ICONS[workoutIcon(category)];
  return <Icon {...p} />;
}
```

- [ ] **Step 4: Run the test**

Run: `bun run test src/lib/workout/__tests__/icons.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workout/icons.ts src/lib/workout/__tests__/icons.test.ts src/components/workout-icon.tsx
git commit -m "feat: workout type icon by category"
```

---

### Task 3: Workout icons in Thumb and the template tiles

**Files:**
- Modify: `src/components/page.tsx` (`Thumb`, around line 114)
- Modify: `src/app/templates/page.tsx` (`Tiles`, around line 88-110)

- [ ] **Step 1: Replace `Thumb`**

```tsx
export function Thumb({ category, label }: { category: string | null | undefined; label: string }) {
  return (
    <div
      style={hueStyle(category)}
      className={cn(
        "flex size-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[10px] text-white/95",
        tileGradient,
      )}
    >
      <WorkoutIcon category={category} size={20} />
      <span className="max-w-full truncate px-1 text-[11px] font-bold leading-none">{label}</span>
    </div>
  );
}
```

Add `import { WorkoutIcon } from "./workout-icon";` to the imports of `page.tsx`.

- [ ] **Step 2: Icon on the tall template tiles**

In `Tiles` in `src/app/templates/page.tsx`, change the name span's `right-2.5` to `right-9` and add the icon after it:

```tsx
          <span className="absolute left-2.5 top-2.5 right-9 text-[15px] font-semibold leading-tight">{t.name}</span>
          <WorkoutIcon category={t.category} size={18} className="absolute right-2.5 top-2.5 text-white/90" />
```

Add `import { WorkoutIcon } from "@/components/workout-icon";`.

- [ ] **Step 3: Typecheck and run the suite**

Run: `bunx tsc --noEmit -p . && bun run test`
Expected: no type errors; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/page.tsx src/app/templates/page.tsx
git commit -m "feat: workout type icons on thumbs and template tiles"
```

---

### Task 4: Prescription facts

**Files:**
- Modify: `src/lib/workout/format.ts` (after `prescriptionParts`, line ~117)
- Test: `src/lib/workout/__tests__/prescription-facts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { formatRest, prescriptionFacts, type Prescription } from "../format";

const empty: Prescription = {
  prescribed_sets_min: null,
  prescribed_sets_max: null,
  prescribed_reps_min: null,
  prescribed_reps_max: null,
  prescribed_rir_min: null,
  prescribed_rir_max: null,
  prescribed_seconds_min: null,
  prescribed_seconds_max: null,
  prescribed_rest_seconds: null,
  prescribed_rpe: null,
  warm_up_sets_min: null,
  warm_up_sets_max: null,
};

describe("prescriptionFacts", () => {
  it("splits a full prescription into Notion's columns", () => {
    const facts = prescriptionFacts({
      ...empty,
      warm_up_sets_min: 2,
      warm_up_sets_max: 3,
      prescribed_sets_min: 3,
      prescribed_sets_max: 3,
      prescribed_reps_min: 8,
      prescribed_reps_max: 10,
      prescribed_rpe: "8",
      prescribed_rest_seconds: 150,
    });
    expect(facts.map((f) => f.kind)).toEqual(["warm", "sets", "reps", "rpe", "rest"]);
    expect(facts.find((f) => f.kind === "sets")?.label).toBe("3 sets");
    expect(facts.find((f) => f.kind === "rest")?.text).toBe(formatRest(150));
  });

  it("reads a hold as time and RIR as its own text", () => {
    expect(prescriptionFacts({ ...empty, prescribed_seconds_min: 30, prescribed_seconds_max: 45 })).toEqual([
      { kind: "time", text: "30-45 s", label: "30-45 s hold" },
    ]);
    expect(prescriptionFacts({ ...empty, prescribed_rir_min: 2, prescribed_rir_max: 2 })[0].kind).toBe("rir");
  });

  it("drops a zero warm-up and says nothing for an empty prescription", () => {
    expect(prescriptionFacts({ ...empty, warm_up_sets_min: 0, warm_up_sets_max: 0 })).toEqual([]);
    expect(prescriptionFacts(empty)).toEqual([]);
  });

  it("uses the singular for one set", () => {
    expect(prescriptionFacts({ ...empty, prescribed_sets_min: 1, prescribed_sets_max: 1 })[0].label).toBe("1 set");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `bun run test src/lib/workout/__tests__/prescription-facts.test.ts`
Expected: FAIL, `prescriptionFacts` is not exported. Check the range format in the "30-45 s" assertion against `range()` in `format.ts`; if `range` joins with another character, match it in the test.

- [ ] **Step 3: Implement, below `prescriptionParts`**

```ts
/** One column of Notion's Sessions table, as the app shows it: the value, and what it means for VoiceOver. */
export type PrescriptionFact = {
  kind: "warm" | "sets" | "reps" | "time" | "rir" | "rpe" | "rest";
  text: string;
  label: string;
};

export function prescriptionFacts(p: Prescription): PrescriptionFact[] {
  const facts: PrescriptionFact[] = [];
  const warm = range(p.warm_up_sets_min, p.warm_up_sets_max);
  if (warm && warm !== "0") facts.push({ kind: "warm", text: warm, label: `${warm} warm-up` });
  const sets = range(p.prescribed_sets_min, p.prescribed_sets_max);
  if (sets) facts.push({ kind: "sets", text: sets, label: `${sets} ${sets === "1" ? "set" : "sets"}` });
  const reps = range(p.prescribed_reps_min, p.prescribed_reps_max);
  const secs = range(p.prescribed_seconds_min, p.prescribed_seconds_max);
  const rir = range(p.prescribed_rir_min, p.prescribed_rir_max);
  if (reps) facts.push({ kind: "reps", text: reps, label: `${reps} reps` });
  else if (secs) facts.push({ kind: "time", text: `${secs} s`, label: `${secs} s hold` });
  else if (rir) facts.push({ kind: "rir", text: `RIR ${rir}`, label: `RIR ${rir}` });
  if (p.prescribed_rpe) facts.push({ kind: "rpe", text: `RPE ${p.prescribed_rpe}`, label: `RPE ${p.prescribed_rpe}` });
  const rest = formatRest(p.prescribed_rest_seconds);
  if (rest) facts.push({ kind: "rest", text: rest, label: `${rest} rest` });
  return facts;
}
```

- [ ] **Step 4: Run the tests**

Run: `bun run test src/lib/workout`
Expected: PASS, including the existing `workout.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workout/format.ts src/lib/workout/__tests__/prescription-facts.test.ts
git commit -m "feat: prescription facts, one per Notion column"
```

---

### Task 5: Icon-labelled prescriptions on the workout card and template rows

**Files:**
- Create: `src/components/prescription-line.tsx`
- Modify: `src/app/workouts/[id]/exercise-card.tsx` (lines ~12-16 imports, 103, 125, 158-175, 220-235)
- Modify: `src/app/templates/[id]/page.tsx` (lines ~108-122)

- [ ] **Step 1: The component**

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { prescriptionFacts, type Prescription, type PrescriptionFact } from "@/lib/workout/format";
import { ClockIcon, FlameIcon, HashIcon, RepeatIcon, type IconProps } from "./icons";

const ICON: Partial<Record<PrescriptionFact["kind"], (p: IconProps) => ReactNode>> = {
  warm: FlameIcon,
  sets: RepeatIcon,
  reps: HashIcon,
  time: ClockIcon,
  rest: ClockIcon,
};

/** A prescription as Notion's Sessions columns read it: each value behind its column icon. */
export function PrescriptionLine({ p, empty, className }: { p: Prescription; empty?: ReactNode; className?: string }) {
  const facts = prescriptionFacts(p);
  if (facts.length === 0) return <>{empty}</>;
  return (
    <span className={cn("inline-flex max-w-full items-center gap-x-2.5 overflow-hidden", className)}>
      {facts.map((f) => {
        const Icon = ICON[f.kind];
        return (
          <span key={f.kind} className="tabular inline-flex shrink-0 items-center gap-1">
            {Icon && <Icon size={14} role="img" aria-hidden={false} aria-label={f.label} className="shrink-0 opacity-70" />}
            <span aria-hidden={Icon ? true : undefined}>{f.text}</span>
          </span>
        );
      })}
    </span>
  );
}
```

- [ ] **Step 2: The workout card header**

In `exercise-card.tsx`, delete `const prescription = prescriptionParts(we);` and replace the subtitle span:

```tsx
          <span className="block truncate text-[15px] leading-5 text-ink-2">
            <PrescriptionLine p={we} empty="No prescription" />
          </span>
```

Remove `prescriptionParts` from the `@/lib/workout/format` import if nothing else in the file uses it, and add `import { PrescriptionLine } from "@/components/prescription-line";`.

- [ ] **Step 3: Icons on the Weight and Reps fields**

Change `NumberField`'s `label: string` to `label: ReactNode` (import `type ReactNode` from react), and its label span to:

```tsx
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-2">{label}</span>
```

Pass the labels with icons:

```tsx
              label={<><DumbbellIcon size={12} />{raw ? "Weight" : unit}</>}
```
```tsx
              label={<><HashIcon size={12} />Reps</>}
```

Add `DumbbellIcon, HashIcon` to the `@/components/icons` import.

- [ ] **Step 4: Template rows**

In `src/app/templates/[id]/page.tsx`, replace the `subtitle={...}` of the exercise row with:

```tsx
                subtitle={
                  <>
                    <PrescriptionLine
                      p={r}
                      empty={
                        r.exercises.machine_location
                          ? null
                          : template.category === "rehab"
                            ? "No dose given"
                            : EQUIPMENT_LABELS[r.exercises.equipment_type]
                      }
                    />
                    {r.exercises.machine_location && (
                      <span>
                        {prescriptionFacts(r).length > 0 ? " · " : ""}
                        {cap(r.exercises.machine_location)}
                      </span>
                    )}
                  </>
                }
```

Update the format import to `CATEGORY_LABELS, EQUIPMENT_LABELS, prescriptionFacts` (drop `prescriptionParts` if unused) and add the `PrescriptionLine` import.

- [ ] **Step 5: Typecheck, lint, tests**

Run: `bunx tsc --noEmit -p . && bun run lint && bun run test`
Expected: clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/prescription-line.tsx "src/app/workouts/[id]/exercise-card.tsx" "src/app/templates/[id]/page.tsx"
git commit -m "feat: prescriptions labelled with Notion's column icons"
```

---

### Task 6: Muscle label icon

**Files:**
- Modify: `src/app/exercises/library.tsx` (row subtitle, ~line 91)
- Modify: `src/app/exercises/[id]/page.tsx` (LargeTitle subtitle, ~line 26)

- [ ] **Step 1: Library rows**

```tsx
                subtitle={
                  <>
                    {i.group && (
                      <>
                        <FigureIcon size={13} className="mr-1 inline align-[-2px] opacity-70" />
                        {i.group} ·{" "}
                      </>
                    )}
                    {EQUIPMENT_LABELS[i.equipment]}
                  </>
                }
```

Add `FigureIcon` to the icons import.

- [ ] **Step 2: Exercise detail**

```tsx
        subtitle={
          <>
            {exercise.muscle_groups?.name && (
              <>
                <FigureIcon size={14} className="mr-1 inline align-[-2px] opacity-70" />
                {exercise.muscle_groups.name} ·{" "}
              </>
            )}
            {[
              EQUIPMENT_LABELS[exercise.equipment_type],
              exercise.machine_location && (exercise.machine_location === "upstairs" ? "Upstairs" : "Downstairs"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </>
        }
```

Import `FigureIcon` from `@/components/icons`.

- [ ] **Step 3: Typecheck and commit**

Run: `bunx tsc --noEmit -p .`
Expected: clean.

```bash
git add src/app/exercises/library.tsx "src/app/exercises/[id]/page.tsx"
git commit -m "feat: muscle group label carries Notion's figure icon"
```

---

### Task 7: Tone classification and region fill

**Files:**
- Create: `scripts/lib/muscle-tones.ts`
- Test: `scripts/lib/__tests__/muscle-tones.test.ts` (match where other `scripts/lib` tests live; `ls scripts/lib` first and follow it)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { classify, fillRegions, mask, TONE } from "../muscle-tones";

/** RGBA from a picture: "." clear, "#" line, "o" body, "w" hit. */
function rgba(rows: string[]): { data: Uint8Array; w: number; h: number } {
  const px = { ".": [0, 0, 0, 0], "#": [69, 69, 69, 255], o: [177, 177, 177, 255], w: [255, 255, 255, 255] } as const;
  const data = new Uint8Array(rows.length * rows[0].length * 4);
  rows.join("").split("").forEach((c, i) => data.set(px[c as keyof typeof px], i * 4));
  return { data, w: rows[0].length, h: rows.length };
}

describe("muscle tones", () => {
  const pic = rgba(["#####", "#oo#w", "#oo#w", "#####", "....."]);

  it("classifies each pixel to the nearest tone, clear below half alpha", () => {
    const t = classify(pic.data);
    expect(t[0]).toBe(TONE.line);
    expect(t[6]).toBe(TONE.body);
    expect(t[9]).toBe(TONE.hit);
    expect(t[20]).toBe(TONE.none);
  });

  it("snaps anti-aliased greys to the nearest tone", () => {
    expect(classify(new Uint8Array([120, 120, 120, 255]))[0]).toBe(TONE.body);
    expect(classify(new Uint8Array([90, 90, 90, 255]))[0]).toBe(TONE.line);
    expect(classify(new Uint8Array([230, 230, 230, 200]))[0]).toBe(TONE.hit);
    expect(classify(new Uint8Array([255, 255, 255, 100]))[0]).toBe(TONE.none);
  });

  it("fills only the region a seed sits in, stopping at lines", () => {
    const t = fillRegions(classify(pic.data), pic.w, pic.h, [[1, 1]], TONE.hit);
    expect([t[6], t[7], t[11], t[12]]).toEqual([TONE.hit, TONE.hit, TONE.hit, TONE.hit]);
    expect(t[9]).toBe(TONE.hit);
    expect(t[0]).toBe(TONE.line);
  });

  it("ignores a seed on a line or outside the drawing", () => {
    const before = classify(pic.data);
    expect(fillRegions(before, pic.w, pic.h, [[0, 0], [2, 4]], TONE.hit)).toEqual(before);
  });

  it("builds black-on-white masks for tracing", () => {
    const t = classify(pic.data);
    expect(mask(t, "silhouette")[0]).toBe(0);
    expect(mask(t, "silhouette")[20]).toBe(255);
    expect(mask(t, "hit")[9]).toBe(0);
    expect(mask(t, "hit")[6]).toBe(255);
    expect(mask(t, "line")[0]).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `bun run test scripts/lib/__tests__/muscle-tones.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
/**
 * Frank's Notion muscle diagrams are three flat tones on a clear background: outline #454545, body #B1B1B1 and the
 * worked muscle in white. These helpers turn a diagram into tones, recolour whole regions (body areas enclosed by
 * outline), and build the black-on-white masks potrace traces.
 */

export const TONE = { none: 0, line: 1, body: 2, hit: 3 } as const;
export type Tone = (typeof TONE)[keyof typeof TONE];

const LEVELS: [Tone, number][] = [
  [TONE.line, 69],
  [TONE.body, 177],
  [TONE.hit, 255],
];

/** One tone per pixel of an RGBA buffer. Pixels under half alpha are clear; the rest snap to the nearest grey. */
export function classify(rgba: Uint8Array): Uint8Array {
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    const g = (rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 2]) / 3;
    let best: Tone = TONE.line;
    let dist = Infinity;
    for (const [tone, level] of LEVELS) {
      const d = Math.abs(g - level);
      if (d < dist) [best, dist] = [tone, d];
    }
    out[i] = best;
  }
  return out;
}

/** Recolours every region a seed sits in (4-connected body or hit pixels) to `to`. Seeds on a line or outside are ignored. */
export function fillRegions(tones: Uint8Array, w: number, h: number, seeds: [number, number][], to: Tone): Uint8Array {
  const out = tones.slice();
  const fillable = (t: number) => t === TONE.body || t === TONE.hit;
  const seen = new Uint8Array(out.length);
  for (const [sx, sy] of seeds) {
    const start = sy * w + sx;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h || !fillable(tones[start]) || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      out[i] = to;
      const x = i % w;
      const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
      for (const n of next) {
        if (n < 0 || n >= out.length || seen[n] || !fillable(tones[n])) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return out;
}

/** Every pixel of `from` becomes `to`. */
export function recolour(tones: Uint8Array, from: Tone, to: Tone): Uint8Array {
  return tones.map((t) => (t === from ? to : t));
}

/**
 * A greyscale mask, 0 where the layer is and 255 elsewhere. The silhouette is the whole drawing, so the body layer has
 * no seams where tones meet; hit and line are drawn over it.
 */
export function mask(tones: Uint8Array, layer: "silhouette" | "hit" | "line"): Uint8Array {
  const on = (t: number) => (layer === "silhouette" ? t !== TONE.none : layer === "hit" ? t === TONE.hit : t === TONE.line);
  return tones.map((t) => (on(t) ? 0 : 255));
}
```

- [ ] **Step 4: Run the tests**

Run: `bun run test scripts/lib/__tests__/muscle-tones.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/muscle-tones.ts scripts/lib/__tests__/muscle-tones.test.ts
git commit -m "feat: tone helpers for tracing the Notion muscle diagrams"
```

---

### Task 8: Art lookup and the empty paths module

**Files:**
- Create: `src/components/muscle-art/slug.ts`
- Create: `src/components/muscle-art/paths.ts` (placeholder until Task 9 generates it)
- Create: `src/components/muscle-art/lookup.ts`
- Test: `src/components/muscle-art/__tests__/lookup.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { artFor } from "../lookup";
import { muscleSlug } from "../slug";

const table = { chest: { body: "M0 0", hit: "M1 1", line: "M2 2" } };

describe("muscle art lookup", () => {
  it("slugs a group name", () => {
    expect(muscleSlug("Chest")).toBe("chest");
    expect(muscleSlug(" Lower Back ")).toBe("lower-back");
  });

  it("finds art by group name, any case", () => {
    expect(artFor("Chest", table)).toBe(table.chest);
    expect(artFor("CHEST", table)).toBe(table.chest);
  });

  it("returns null for a group with no art", () => {
    expect(artFor("Neck", table)).toBeNull();
    expect(artFor(null, table)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `bun run test src/components/muscle-art`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`slug.ts`:

```ts
/** The key a muscle group's art is stored under: its name, lower case, words joined by hyphens. */
export function muscleSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
```

`paths.ts` (placeholder; Task 9 overwrites it):

```ts
// Generated by scripts/trace-muscle-art.ts (bun run art:muscles). Do not edit by hand.
export type MuscleArtPaths = { body: string; hit: string; line: string };
export const MUSCLE_ART_SIZE = 512;
export const MUSCLE_ART: Record<string, MuscleArtPaths> = {};
```

`lookup.ts`:

```ts
import { MUSCLE_ART, type MuscleArtPaths } from "./paths";
import { muscleSlug } from "./slug";

export function artFor(group: string | null | undefined, table: Record<string, MuscleArtPaths> = MUSCLE_ART): MuscleArtPaths | null {
  if (!group) return null;
  return table[muscleSlug(group)] ?? null;
}
```

- [ ] **Step 4: Run the tests**

Run: `bun run test src/components/muscle-art`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/muscle-art
git commit -m "feat: muscle art lookup by group name"
```

---

### Task 9: The tracing script

**Files:**
- Create: `scripts/trace-muscle-art.ts`
- Create: `scripts/types/potrace.d.ts`
- Modify: `package.json` (script + dev dependency), `.gitignore`
- Generated: `src/components/muscle-art/paths.ts`

- [ ] **Step 1: Install potrace**

Run: `bun add -d potrace`
Expected: `potrace` in devDependencies.

- [ ] **Step 2: Types for potrace**

`scripts/types/potrace.d.ts`:

```ts
declare module "potrace" {
  type Options = { turdSize?: number; optTolerance?: number; threshold?: number; blackOnWhite?: boolean; turnPolicy?: string };
  export class Potrace {
    constructor(options?: Options);
    loadImage(image: Buffer | string, callback: (err: Error | null) => void): void;
    getPathTag(fillColor?: string): string;
  }
}
```

If `tsc` does not pick it up, add `"scripts/types"` to `include` in `tsconfig.json`.

- [ ] **Step 3: Gitignore the downloads**

Append to `.gitignore`:

```
# Notion muscle diagrams, downloaded by art:muscles; the traced paths are committed
/scripts/data/muscles/
```

- [ ] **Step 4: The script**

`scripts/trace-muscle-art.ts`:

```ts
/**
 * Traces Frank's Notion muscle group diagrams into SVG path data for <MuscleArt>.
 *
 * Downloads each Muscle Groups cover into scripts/data/muscles/ (once; pass --refresh to fetch again), reads it as
 * three tones, derives the groups Notion has no diagram for, traces each layer with potrace and writes
 * src/components/muscle-art/paths.ts. Also writes scripts/data/muscles/preview.png, every group on one sheet, to
 * check the derived regions.
 *
 * Run with: bun run art:muscles
 */

import { Client as NotionClient } from "@notionhq/client";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Potrace } from "potrace";
import sharp from "sharp";

import { muscleSlug } from "../src/components/muscle-art/slug";
import { classify, fillRegions, mask, recolour, TONE } from "./lib/muscle-tones";

const SIZE = 512;
const DIR = join(import.meta.dir, "data", "muscles");
const OUT = join(import.meta.dir, "..", "src", "components", "muscle-art", "paths.ts");
const MUSCLE_GROUPS = "a15e89cd-9e40-4855-bf45-d1a6edee439b";

/** The ten groups Frank drew. Cardio's and Stretches' Notion covers are photos, so they are not used. */
const DRAWN = ["chest", "shoulders", "triceps", "back", "biceps", "abs", "quadriceps", "hamstrings", "glutes", "calves"];

/** Groups with no drawing, made from one. Seeds are in SIZE px, inside the regions to fill; check preview.png. */
const DERIVED: Record<string, { base: string; hit: "clear" | "all"; seeds?: [number, number][] }> = {
  forearms: { base: "biceps", hit: "clear", seeds: [[90, 300], [115, 300], [397, 300], [422, 300]] },
  neck: { base: "back", hit: "clear", seeds: [[250, 40], [285, 40]] },
  cardio: { base: "chest", hit: "all" },
  stretches: { base: "chest", hit: "clear" },
};

async function download(refresh: boolean) {
  await mkdir(DIR, { recursive: true });
  const notion = new NotionClient({ auth: process.env.NOTION_API_KEY });
  const res = await notion.dataSources.query({ data_source_id: MUSCLE_GROUPS });
  for (const page of res.results) {
    if (!("properties" in page)) continue;
    const title = page.properties.Name;
    const name = title.type === "title" ? title.title.map((t) => t.plain_text).join("") : "";
    const slug = muscleSlug(name);
    const file = join(DIR, `${slug}.png`);
    if (!DRAWN.includes(slug) || (existsSync(file) && !refresh)) continue;
    const url = page.cover?.type === "file" ? page.cover.file.url : null;
    if (!url) throw new Error(`${name} has no uploaded cover`);
    await writeFile(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
    console.log(`downloaded ${slug}`);
  }
}

async function tones(slug: string): Promise<Uint8Array> {
  const { data } = await sharp(join(DIR, `${slug}.png`)).ensureAlpha().resize(SIZE, SIZE).raw().toBuffer({ resolveWithObject: true });
  return classify(new Uint8Array(data));
}

async function trace(layer: Uint8Array): Promise<string> {
  if (!layer.includes(0)) return "";
  const png = await sharp(Buffer.from(layer), { raw: { width: SIZE, height: SIZE, channels: 1 } }).png().toBuffer();
  const potrace = new Potrace({ turdSize: 4, optTolerance: 0.4, threshold: 128, blackOnWhite: true });
  await new Promise<void>((resolve, reject) => potrace.loadImage(png, (err) => (err ? reject(err) : resolve())));
  const d = /\sd="([^"]*)"/.exec(potrace.getPathTag())?.[1] ?? "";
  return d.replace(/\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10)).replace(/\s+/g, " ").trim();
}

async function main() {
  await download(process.argv.includes("--refresh"));

  const all: Record<string, Uint8Array> = {};
  for (const slug of DRAWN) all[slug] = await tones(slug);
  for (const [slug, d] of Object.entries(DERIVED)) {
    const base = all[d.base];
    let t = d.hit === "clear" ? recolour(base, TONE.hit, TONE.body) : recolour(base, TONE.body, TONE.hit);
    if (d.seeds) t = fillRegions(t, SIZE, SIZE, d.seeds, TONE.hit);
    all[slug] = t;
  }

  const art: Record<string, { body: string; hit: string; line: string }> = {};
  for (const [slug, t] of Object.entries(all)) {
    art[slug] = { body: await trace(mask(t, "silhouette")), hit: await trace(mask(t, "hit")), line: await trace(mask(t, "line")) };
    console.log(`traced ${slug}`);
  }

  const body = Object.entries(art)
    .map(([slug, a]) => `  ${JSON.stringify(slug)}: {\n    body: ${JSON.stringify(a.body)},\n    hit: ${JSON.stringify(a.hit)},\n    line: ${JSON.stringify(a.line)},\n  },`)
    .join("\n");
  await writeFile(
    OUT,
    `// Generated by scripts/trace-muscle-art.ts (bun run art:muscles). Do not edit by hand.\n` +
      `export type MuscleArtPaths = { body: string; hit: string; line: string };\n` +
      `export const MUSCLE_ART_SIZE = ${SIZE};\n` +
      `export const MUSCLE_ART: Record<string, MuscleArtPaths> = {\n${body}\n};\n`,
  );

  // Contact sheet in the light tones, to check the traces and the derived regions
  const tiles = await Promise.all(
    Object.entries(art).map(async ([slug, a]) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="280" viewBox="0 0 ${SIZE} ${SIZE + 48}"><rect width="100%" height="100%" fill="#fff"/><path d="${a.body}" fill="#B1B1B1" fill-rule="evenodd"/><path d="${a.hit}" fill="#fff" fill-rule="evenodd"/><path d="${a.line}" fill="#454545" fill-rule="evenodd"/><text x="16" y="${SIZE + 36}" font-size="32" font-family="sans-serif">${slug}</text></svg>`;
      return sharp(Buffer.from(svg)).png().toBuffer();
    }),
  );
  const cols = 5;
  await sharp({ create: { width: 256 * cols, height: 280 * Math.ceil(tiles.length / cols), channels: 4, background: "#ddd" } })
    .composite(tiles.map((input, i) => ({ input, left: (i % cols) * 256, top: Math.floor(i / cols) * 280 })))
    .png()
    .toFile(join(DIR, "preview.png"));
  console.log(`wrote ${OUT} and ${join(DIR, "preview.png")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Add to `package.json` scripts after `icons:generate`:

```json
    "art:muscles": "bun run scripts/trace-muscle-art.ts",
```

- [ ] **Step 5: Run it**

Run: `set -a; source .env.local; set +a; bun run art:muscles` (if `.env.local` is already loaded by bun automatically, plain `bun run art:muscles`).
Expected: "downloaded" for each of the ten, "traced" for fourteen, then "wrote ...".

- [ ] **Step 6: Check the preview**

Open `scripts/data/muscles/preview.png` with the Read tool. Check: ten traces match the Notion diagrams; Forearms shows only the four forearm regions white; Neck shows only the neck/upper traps white; Cardio is all white inside the outlines; Stretches has no white. If a derived region is wrong, move its seed (in 512 px: x right, y down) and rerun. Rendering `scripts/data/muscles/<base>.png` resized to 512 with a grid helps place seeds.

- [ ] **Step 7: Check the size**

Run: `wc -c src/components/muscle-art/paths.ts`
Expected: under ~400 KB. If larger, raise `turdSize` to 8 and `optTolerance` to 0.8 and rerun.

- [ ] **Step 8: Tests and commit**

Run: `bun run test && bunx tsc --noEmit -p .`
Expected: pass, clean.

```bash
git add scripts/trace-muscle-art.ts scripts/types/potrace.d.ts package.json bun.lock .gitignore src/components/muscle-art/paths.ts
git commit -m "feat: trace the Notion muscle diagrams into SVG paths"
```

(Use whichever lockfile the repo has, `bun.lock` or `bun.lockb`.)

---

### Task 10: MuscleArt component and tokens

**Files:**
- Create: `src/components/muscle-art/muscle-art.tsx`
- Modify: `src/app/globals.css` (light `:root` block after `--orange: #ff9500;`, both dark blocks after `--orange: #ff9f0a;`)

- [ ] **Step 1: Tokens**

After `--orange: #ff9500;` in `:root`:

```css
  /* Muscle diagrams, Notion's tones: outline, body, the worked muscle, and the tile behind them */
  --muscle-line: #454545;
  --muscle-body: #b1b1b1;
  --muscle-hit: #ffffff;
  --muscle-tile: #ffffff;
```

After each `--orange: #ff9f0a;` (both dark blocks; Edit with replace_all):

```css
  --muscle-line: #d1d1d6;
  --muscle-body: #48484a;
  --muscle-hit: #ffffff;
  --muscle-tile: #1c1c1e;
```

- [ ] **Step 2: The component (server-safe, no "use client")**

```tsx
import { cn } from "@/lib/cn";
import { FigureIcon } from "../icons";
import { artFor } from "./lookup";
import { MUSCLE_ART_SIZE } from "./paths";

/** A muscle group's diagram from Notion, in the theme's muscle tones. Groups with no art show the figure icon. */
export function MuscleArt({ group, className }: { group: string; className?: string }) {
  const art = artFor(group);
  if (!art) {
    return (
      <div className={cn("grid size-full place-items-center text-[var(--muscle-body)]", className)}>
        <FigureIcon size={44} />
      </div>
    );
  }
  return (
    <svg viewBox={`0 0 ${MUSCLE_ART_SIZE} ${MUSCLE_ART_SIZE}`} className={cn("size-full", className)} aria-hidden="true">
      <path d={art.body} fill="var(--muscle-body)" fillRule="evenodd" />
      {art.hit && <path d={art.hit} fill="var(--muscle-hit)" fillRule="evenodd" />}
      <path d={art.line} fill="var(--muscle-line)" fillRule="evenodd" />
    </svg>
  );
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `bunx tsc --noEmit -p .`

```bash
git add src/components/muscle-art/muscle-art.tsx src/app/globals.css
git commit -m "feat: MuscleArt in the theme's muscle tones"
```

---

### Task 11: The muscle group grid on Library

**Files:**
- Modify: `src/app/exercises/page.tsx`
- Modify: `src/app/exercises/library.tsx`

- [ ] **Step 1: Pass the art from the server page**

In `page.tsx`, import `MuscleArt` from `@/components/muscle-art/muscle-art` and pass:

```tsx
      <ExerciseLibrary
        items={items}
        groups={groups.filter((g) => used.has(g.id)).map((g) => ({ id: g.id, name: g.name, art: <MuscleArt group={g.name} /> }))}
        unit={settings.weight_unit}
      />
```

Change its comment to `// Groups with no exercises in them only add noise to the grid`.

- [ ] **Step 2: Library state and filter**

In `library.tsx`: change the `groups` prop type to `{ id: string; name: string; art: ReactNode }[]` (import `type ReactNode` from react); delete the `onlyLogged` state and its clause in the filter (`(!onlyLogged || i.last) &&`) and from the `useMemo` deps.

- [ ] **Step 3: Replace the chip row with the grid**

Replace the whole `<div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3"> ... </div>` with:

```tsx
      {/* Notion's Muscle Groups gallery: tap a card to filter, tap it again to clear */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5 px-4 pb-4">
        {groups.map((g) => {
          const on = group === g.id;
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={on}
              onClick={() => setGroup(on ? null : g.id)}
              className={cn(
                "overflow-hidden rounded-[18px] bg-card text-left transition-shadow active:opacity-80",
                on && "ring-2 ring-blue",
              )}
            >
              <div className="aspect-square bg-[var(--muscle-tile)] p-2">{g.art}</div>
              <div className="flex items-center gap-1.5 px-2.5 py-2 text-[15px] font-medium leading-5">
                <FigureIcon size={15} className="shrink-0 opacity-60" />
                <span className="truncate">{g.name}</span>
              </div>
            </button>
          );
        })}
      </div>
```

Delete `ChipButton` if nothing else uses it. Add `FigureIcon` to the icons import.

- [ ] **Step 4: Typecheck, lint, tests**

Run: `bunx tsc --noEmit -p . && bun run lint && bun run test`
Expected: clean, all pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/exercises/page.tsx src/app/exercises/library.tsx
git commit -m "feat: muscle group card grid on Library, Logged filter removed"
```

---

### Task 12: Visual check and docs

- [ ] **Step 1: Build**

Run: `bun run build`
Expected: compiles with no errors.

- [ ] **Step 2: Look at it**

Run `bun run dev` in the background, then with Playwright at 390 x 844: `/exercises`, `/templates`, a template detail, `/` and an active workout. Screenshot each in light and dark (Settings or `document.documentElement.dataset.theme`). Check: the grid is three columns at 390 wide; diagrams read in both themes; the selected card ring shows and the list filters; icons sit on the text baseline; nothing truncates badly in the workout card header. If WebGPU is available in the browser, check that `html.gpu` paints the diagrams the same as the CSS path.

- [ ] **Step 3: CLAUDE.md**

In `CLAUDE.md`, add `bun run art:muscles       # Notion muscle diagrams -> src/components/muscle-art/paths.ts` to Commands, and under App a short paragraph:

```
Muscle art: Frank's Notion Muscle Groups covers, traced by
`scripts/trace-muscle-art.ts` into `src/components/muscle-art/paths.ts`
(generated, committed; downloads gitignored in `scripts/data/muscles/`).
Forearms, Neck, Cardio and Stretches are derived from his drawings by
flood fill. `<MuscleArt>` fills the paths from `--muscle-*` tokens and
renders on the server. The icons beside prescriptions, workout types and
muscle labels are Notion's, redrawn in `icons.tsx`.
```

Update the test count line ("N tests across M files") from the output of `bun run test`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: muscle art pipeline and Notion icons"
```
