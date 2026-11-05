import { cn } from "@/lib/cn";
import { equipmentChoices, optionForEquipment, optionForTechnique, techniqueChoices, techniqueLabel, type MovementOption } from "@/lib/workout/movements";
import { ChevronUpDown } from "./icons";

/** One labelled pop-up button: a painted value and chevrons with the real select invisible over them, as Floor is. */
function PopUp({ label, value, options, disabled, onChange }: { label: string; value: string; options: string[]; disabled?: boolean; onChange: (v: string) => void }) {
  return (
    <div className={cn("relative flex h-11 items-center justify-between gap-3", disabled && "opacity-40")}>
      <span className="shrink-0 text-[15px] text-ink-2">{label}</span>
      <span aria-hidden className="flex min-w-0 items-center gap-1 text-[15px] font-medium text-blue">
        <span className="truncate">{value}</span>
        <ChevronUpDown size={14} strokeWidth={2.2} className="shrink-0" />
      </span>
      <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0">
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The ways of doing one movement. Each choice is a library row with its own image and history, so choosing switches to
 * that row. A pop-up shows only when there is more than one choice. Rule: a segmented control switches the view, a
 * pop-up button sets a value.
 */
export function MovementPicker({ options, currentId, disabled, onSelect }: { options: MovementOption[]; currentId: string; disabled?: boolean; onSelect: (id: string) => void }) {
  const current = options.find((o) => o.id === currentId);
  if (!current) return null;
  const equipment = equipmentChoices(options);
  const techniques = techniqueChoices(options, current.equipment);
  return (
    <>
      {equipment.length > 1 && (
        <PopUp
          label="Equipment"
          value={current.equipment}
          options={equipment}
          disabled={disabled}
          onChange={(v) => {
            const next = optionForEquipment(options, v, current.technique);
            if (next && next.id !== currentId) onSelect(next.id);
          }}
        />
      )}
      {techniques.length > 1 && (
        <PopUp
          label="Technique"
          value={techniqueLabel(current.technique)}
          options={techniques}
          disabled={disabled}
          onChange={(v) => {
            const next = optionForTechnique(options, current.equipment, v);
            if (next && next.id !== currentId) onSelect(next.id);
          }}
        />
      )}
    </>
  );
}
