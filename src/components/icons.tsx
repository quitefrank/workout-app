import type { SVGProps } from "react";

/**
 * Line icons in the spirit of SF Symbols (medium weight, round caps).
 * SF Symbols cannot ship in a web app, so these are drawn to match.
 */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);

export const TemplatesIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="3.5" width="16" height="17" rx="3.5" />
    <path d="M8 8.5h8M8 12h8M8 15.5h5" />
  </Svg>
);

export const LibraryIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 9.5v5M21.5 9.5v5M5.5 7v10M18.5 7v10M5.5 12h13" />
  </Svg>
);

export const ProgressIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 20.5h17" />
    <path d="M4.5 15.5l5-5 4 3.5 6-7" />
    <path d="M15.5 7h4v4" />
  </Svg>
);

export const GearIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
);

export const ChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 4.5L7.5 12l7.5 7.5" />
  </Svg>
);

export const ChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 4.5l7.5 7.5L9 19.5" />
  </Svg>
);

export const ChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 9l7.5 7.5L19.5 9" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.5v15M4.5 12h15" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12.5l5 5 10-11" />
  </Svg>
);

export const XIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const PlayIcon = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" />
  </Svg>
);

export const TimerIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 9.5v4l2.5 2M9.5 2.5h5" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5l5 5" />
  </Svg>
);

export const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="0.6" fill="currentColor" />
    <circle cx="4.5" cy="12" r="0.6" fill="currentColor" />
    <circle cx="4.5" cy="18" r="0.6" fill="currentColor" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6.5h16M9.5 6.5V4.5h5v2M6.5 6.5l1 13.5h9l1-13.5" />
  </Svg>
);

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 5.5l4 4M4 20l1-5L15.5 4.5a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3L9 19z" />
  </Svg>
);

export const ArrowUpDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 20V4M3.5 8l4-4 4 4M16.5 4v16M12.5 16l4 4 4-4" />
  </Svg>
);

export const TrophyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v3.5M8 20.5h8M9.5 17.5h5" />
  </Svg>
);

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
