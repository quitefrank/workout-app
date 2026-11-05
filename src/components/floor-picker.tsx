import { cn } from "@/lib/cn";
import { FLOORS, floorLabel, type MachineLocation } from "@/lib/workout/machine-location";
import { ChevronUpDown } from "./icons";

/**
 * The floor of a two-floor exercise: the kit's pop-up button (754:64091 opens its menu, 410:50568 is the button), as a
 * labelled row. Rule: a segmented control switches the view, a pop-up button sets a value. The value and chevrons are
 * painted with the page; the real select lies over the row, invisible, so a tap opens the iOS menu, as in Settings.
 */
export function FloorPicker({
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
    <div className={cn("relative flex h-11 items-center justify-between", disabled && "opacity-40", className)}>
      <span className="text-[15px] text-ink-2">Floor</span>
      <span aria-hidden className="flex items-center gap-1 text-[15px] font-medium text-blue">
        {floorLabel(value) ?? "Choose"}
        <ChevronUpDown size={14} strokeWidth={2.2} />
      </span>
      <select
        aria-label="Floor"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as MachineLocation)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        {value === null && <option value="">Choose</option>}
        {FLOORS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
}
