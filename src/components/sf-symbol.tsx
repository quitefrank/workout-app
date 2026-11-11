import { useId } from "react";
import { SF_SYMBOLS, type SfSymbolName } from "./sf-symbol-data";

/**
 * An SF Symbol, rendered by macOS (scripts/sf-symbols.js) and drawn here as an inline <svg> whose rect takes the text
 * colour through the glyph as a mask. Inline svg rather than a CSS mask, so the glass stage's tab layer, which reads
 * `[data-tab-icon] svg`, can draw it; the glyph is a data URI because an svg drawn as an image loads nothing external.
 * `scale` multiplies the symbol's own point size (1 is the size it was rendered at), keeping each symbol's proportions, as
 * SF Symbols sit at one point size with varying widths.
 */
export function SfSymbol({ name, scale = 1, className }: { name: SfSymbolName; scale?: number; className?: string }) {
  const { w, h, src } = SF_SYMBOLS[name];
  const id = `sf${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true">
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
        <image href={src} x="0" y="0" width={w} height={h} />
      </mask>
      <rect width={w} height={h} fill="currentColor" mask={`url(#${id})`} />
    </svg>
  );
}
