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

/*
 * Notion's own icons, as the Workout page shows them on its columns and workout pages (notion.so/icons/<name>_gray.svg).
 * Filled on a 20 x 20 grid; the fill follows currentColor so they take the theme's ink.
 */

function NotionSvg({ size = 22, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

/** Notion `fire` */
export const FlameIcon = (p: IconProps) => (
  <NotionSvg {...p}>
    <path d="m14.997 5-4.372 2.916V1.875A6.248 6.248 0 0 0 4.663 10H2.5c0 4.14 3.36 7.5 7.5 7.5s7.5-3.36 7.5-7.5c0-2.047-.984-3.86-2.503-5M10 15.625a2.5 2.5 0 1 1 0-5v2.5l2.081-1.387A2.5 2.5 0 0 1 10 15.625" />
  </NotionSvg>
);

/** Notion `repeat` */
export const RepeatIcon = (p: IconProps) => (
  <NotionSvg {...p}>
    <path d="M15.625 10H17.5v.625c0 2.716-1.972 4.688-4.687 4.688H5.856l1.8 1.8-1.325 1.325-4.062-4.063 4.062-4.062 1.325 1.324-1.8 1.8h6.957c1.68 0 2.812-1.13 2.812-2.812zm-11.25-.625c0-1.681 1.131-2.812 2.813-2.812h6.956l-1.8 1.8 1.325 1.325 4.062-4.063-4.062-4.062-1.325 1.325 1.8 1.8H7.188C4.472 4.688 2.5 6.659 2.5 9.375V10h1.875z" />
  </NotionSvg>
);

/** Notion `hashtag` */
export const HashIcon = (p: IconProps) => (
  <NotionSvg {...p}>
    <path d="M16.875 8.125V6.25h-2.5l.938-3.75h-1.876L12.5 6.25H9.375l.938-3.75H8.437L7.5 6.25H3.75v1.875h3.281l-.937 3.75H3.125v1.875h2.5l-.937 3.75h1.875l.937-3.75h3.125l-.937 3.75h1.874l.938-3.75h3.75v-1.875h-3.281l.937-3.75zm-5.781 3.75H7.969l.937-3.75h3.125z" />
  </NotionSvg>
);

/** Notion `gym` */
export const DumbbellIcon = (p: IconProps) => (
  <NotionSvg {...p}>
    <path d="M18.75 13.75h-1.875v1.875H13.75V11.25h-7.5v4.375H3.125V13.75H1.25v-7.5h1.875V4.375H6.25V8.75h7.5V4.375h3.125V6.25h1.875z" />
  </NotionSvg>
);

/** Notion `clock` */
export const ClockIcon = (p: IconProps) => (
  <NotionSvg {...p}>
    <path d="M10 2.5c-4.14 0-7.5 3.36-7.5 7.5s3.36 7.5 7.5 7.5 7.5-3.36 7.5-7.5-3.36-7.5-7.5-7.5m4.375 8.75H9.063V5h1.874v4.375h3.438z" />
  </NotionSvg>
);

/** Notion `accessibility` */
export const FigureIcon = (p: IconProps) => (
  <NotionSvg {...p}>
    <path d="M10 2.5c-4.14 0-7.5 3.36-7.5 7.5s3.36 7.5 7.5 7.5 7.5-3.36 7.5-7.5-3.36-7.5-7.5-7.5m0 1.563c.772 0 1.25.478 1.25 1.25 0 .771-.478 1.25-1.25 1.25s-1.25-.479-1.25-1.25c0-.772.478-1.25 1.25-1.25m4.375 4.687h-3.203v1.953l1.64 4.922h-1.48L10 11.635l-1.331 3.99H7.187l1.641-4.922V8.75H5.625V7.5h8.75z" />
  </NotionSvg>
);

/** Notion `hand` */
export const HandIcon = (p: IconProps) => (
  <NotionSvg {...p}>
    <path d="M15.938 8.438v3.18c0 1.523-.441 2.554-1.538 3.607l-1.1 1.056c-.91.875-1.769 1.219-3.031 1.219H8.747c-2.7 0-4.375-1.675-4.375-4.375V5.781c0-.481.3-.781.781-.781s.781.3.781.781v3.907h.938V3.906c0-.481.3-.781.781-.781s.781.3.781.781v5.781h.938V3.282c0-.481.3-.781.781-.781s.781.3.781.781v6.406h.938V4.532c0-.481.3-.781.781-.781s.781.3.781.781v7.344c.482 0 .782-.3.782-.781v-.781c0-1.391.537-2.188 1.406-2.188.203 0 .312.11.312.313z" />
  </NotionSvg>
);

/** Notion `pants` */
export const PantsIcon = (p: IconProps) => (
  <NotionSvg {...p}>
    <path d="M10.625 8.125h-1.25l-2.5 10-3.75-.625 2.5-15h8.75l2.5 15-3.75.625z" />
  </NotionSvg>
);

/** Notion `shoe` */
export const ShoeIcon = (p: IconProps) => (
  <NotionSvg {...p}>
    <path d="M18.75 9.375v1.875s-1.666 2.5-6.666 2.5H1.25v-1.578c0-.684.056-1.153.225-1.819L2.5 6.25h1.25s.35 1.875 2.5 1.875 2.5-1.875 2.5-1.875H10l6.25 3.125z" />
  </NotionSvg>
);

/** Notion `tshirt` */
export const ShirtIcon = (p: IconProps) => (
  <NotionSvg {...p}>
    <path d="m18.75 6.875-2.5 2.5L14.375 7.5v10h-8.75v-10L3.75 9.375l-2.5-2.5 3.278-3.278C5.313 2.813 6.068 2.5 7.181 2.5h.322s.35 1.875 2.5 1.875 2.5-1.875 2.5-1.875h.322c1.113 0 1.866.313 2.653 1.097l3.278 3.278z" />
  </NotionSvg>
);
