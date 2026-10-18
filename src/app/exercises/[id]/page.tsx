import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCircleLink } from "@/components/glass";
import { ChevronLeft, FigureIcon, TrophyIcon } from "@/components/icons";
import { LargeTitle, Row, Screen, SectionHeader } from "@/components/page";
import { getExercise, getSettings, getTopSets } from "@/lib/data/queries";
import { dayLabel, localDate } from "@/lib/workout/dates";
import { displayWeight, EQUIPMENT_LABELS, epley, formatNumber } from "@/lib/workout/format";
import { bests } from "@/lib/workout/progress";
import { E1rmChart } from "./e1rm-chart";

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [exercise, tops, settings] = await Promise.all([getExercise(id), getTopSets(id), getSettings()]);
  if (!exercise) notFound();
  const unit = settings.weight_unit;
  const w = (n: number) => displayWeight(n, exercise.equipment_type, unit) || "BW";
  const recent = [...tops].reverse().slice(0, 8);
  const best = bests(tops);
  const embed = youtubeEmbed(exercise.video_url);

  return (
    <Screen>
      <LargeTitle
        title={exercise.name}
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
        leading={
          <GlassCircleLink href="/exercises" label="Back to library">
            <ChevronLeft size={20} />
          </GlassCircleLink>
        }
      />

      {embed ? (
        <div className="mx-4 mt-4 aspect-video overflow-hidden rounded-[26px] bg-card">
          <iframe
            src={embed}
            title={`${exercise.name} demonstration`}
            className="size-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : (
        exercise.video_url && (
          <a href={exercise.video_url} target="_blank" rel="noreferrer" className="mx-4 mt-4 block rounded-[20px] bg-card px-4 py-3 text-[17px] text-blue">
            Watch the demonstration
          </a>
        )
      )}

      {exercise.notes && <p className="mx-4 mt-3 text-[15px] text-ink-2">{exercise.notes}</p>}

      {tops.length > 0 && best.heaviest && best.bestE1rm && (
        <>
          <SectionHeader title="Personal Records" />
          <div className="mx-4 grid grid-cols-2 gap-2.5">
            <Pr label="Heaviest" value={w(best.heaviest.weight)} detail={`× ${best.heaviest.reps} · ${dayLabel(localDate(best.heaviest.completed_at), { year: true })}`} />
            <Pr
              label="Est. 1RM"
              value={w(Math.round(best.bestE1rm.e1rm))}
              detail={`${formatNumber(best.bestE1rm.weight)} × ${best.bestE1rm.reps} · ${dayLabel(localDate(best.bestE1rm.completed_at), { year: true })}`}
            />
          </div>
        </>
      )}

      {tops.length > 1 && (
        <>
          <SectionHeader title="Estimated 1RM" />
          <div className="mx-4 rounded-[26px] bg-card px-2 pb-2 pt-4">
            <E1rmChart
              points={tops.map((t) => ({ date: localDate(t.completed_at), e1rm: epley(t.weight, t.reps), top: t.weight }))}
            />
          </div>
        </>
      )}

      <SectionHeader title="Recent" />
      {recent.length ? (
        <div className="grouped mx-4">
          {recent.map((t) => (
            <Link key={t.workout_id} href={`/workouts/${t.workout_id}/summary`} className="block active:bg-fill">
              <Row
                title={`${w(t.weight)} × ${t.reps}`}
                subtitle={dayLabel(localDate(t.completed_at), { year: true })}
                value={`e1RM ${formatNumber(epley(t.weight, t.reps))}`}
                chevron
              />
            </Link>
          ))}
        </div>
      ) : (
        <p className="mx-4 rounded-[20px] bg-card px-4 py-3 text-[15px] text-ink-2">Not logged yet.</p>
      )}

      {exercise.alternates.length > 0 && (
        <>
          <SectionHeader title="Alternates" />
          <div className="grouped mx-4">
            {exercise.alternates.map((a) => (
              <Link key={a.position} href={`/exercises/${a.exercise.id}`} className="block active:bg-fill">
                <Row title={a.exercise.name} subtitle={`Option ${a.position}`} chevron />
              </Link>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}

function Pr({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[22px] bg-card px-4 py-3">
      <div className="flex items-center gap-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-orange">
        <TrophyIcon size={14} /> {label}
      </div>
      <div className="tabular mt-1 text-[24px] font-bold leading-7">{value}</div>
      <div className="tabular mt-0.5 text-[13px] text-ink-2">{detail}</div>
    </div>
  );
}

/** A YouTube watch, short or youtu.be link as its embed URL; anything else stays a link. */
function youtubeEmbed(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    else if (u.hostname.endsWith("youtube.com")) {
      id = u.searchParams.get("v") ?? (u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1] ?? null);
    }
    if (!id || !/^[\w-]{6,}$/.test(id)) return null;
    const start = u.searchParams.get("t")?.replace(/s$/, "");
    return `https://www.youtube-nocookie.com/embed/${id}${start && /^\d+$/.test(start) ? `?start=${start}` : ""}`;
  } catch {
    return null;
  }
}
