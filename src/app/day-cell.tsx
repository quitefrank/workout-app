import { hueStyle } from "@/components/page";
import { cn } from "@/lib/cn";
import type { CalendarDot } from "@/lib/workout/calendar";
import { dayLabel, type CalendarCell } from "@/lib/workout/dates";

/** One day in the week strip or the month panel: its number, circled when selected, over a dot per workout. */
export function DayCell({
  cell,
  dots = [],
  today,
  selected,
  onPick,
}: {
  cell: CalendarCell;
  dots?: CalendarDot[];
  today: string;
  selected: string;
  onPick: (date: string) => void;
}) {
  const isToday = cell.date === today;
  const isSelected = cell.date === selected;
  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={isSelected}
      aria-label={`${dayLabel(cell.date)}${dots.length ? `, ${dots.length} workout${dots.length > 1 ? "s" : ""}` : ""}`}
      onClick={() => onPick(cell.date)}
      className="flex h-full flex-col items-center justify-start gap-1 pt-1"
    >
      <span
        className={cn(
          "tabular grid size-8 place-items-center rounded-full text-[17px]",
          isToday && !isSelected && "font-semibold text-red",
          isSelected && (isToday ? "bg-red font-semibold text-white" : "bg-ink font-semibold text-bg"),
        )}
      >
        {cell.day}
      </span>
      <span className="flex h-1.5 gap-[3px]">
        {dots.slice(0, 3).map((d) => (
          <span
            key={d.id}
            style={hueStyle(d.category)}
            className={cn("size-1.5 rounded-full", d.done ? "bg-[hsl(var(--h)_70%_52%)]" : "ring-1 ring-[hsl(var(--h)_70%_52%)] ring-inset")}
          />
        ))}
      </span>
    </button>
  );
}
