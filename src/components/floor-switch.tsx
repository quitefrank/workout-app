import { cn } from "@/lib/cn";
import { FLOORS, type MachineLocation } from "@/lib/workout/machine-location";

/** Which floor a two-floor exercise is on: the kit's segmented control (content layer, not glass). */
export function FloorSwitch({
  value,
  disabled,
  onChange,
  className,
}: {
  value: MachineLocation | null;
  disabled?: boolean;
  onChange: (floor: MachineLocation) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Floor" className={cn("flex gap-1 rounded-full bg-fill p-0.5", className)}>
      {FLOORS.map((f) => {
        const on = value === f.value;
        return (
          <button
            key={f.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(f.value)}
            className={cn("h-8 flex-1 rounded-full text-[13px] font-medium transition", on && "bg-[var(--seg-on)] font-semibold shadow-[var(--seg-shadow)]")}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
