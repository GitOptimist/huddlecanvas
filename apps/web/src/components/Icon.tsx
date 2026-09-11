import type { SVGProps } from "react";

export type IconName =
  | "arrow"
  | "board"
  | "check"
  | "chevron"
  | "chevron-down"
  | "clock"
  | "cloud"
  | "cloud-check"
  | "connector"
  | "cursor"
  | "database"
  | "frame"
  | "grid"
  | "hand"
  | "history"
  | "layers"
  | "logout"
  | "note"
  | "plus"
  | "refresh"
  | "search"
  | "shield"
  | "text";

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...props }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, React.ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    board: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 4v16M8 9h13" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    "chevron-down": <path d="m6 9 6 6 6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    cloud: (
      <>
        <path d="M7 18h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.3 8.6 4.5 4.5 0 0 0 7 18Z" />
      </>
    ),
    "cloud-check": (
      <>
        <path d="M7 18h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.3 8.6 4.5 4.5 0 0 0 7 18Z" />
        <path d="m9 13 2 2 4-4" />
      </>
    ),
    connector: (
      <>
        <circle cx="5" cy="17" r="2" />
        <circle cx="19" cy="7" r="2" />
        <path d="M7 16c4-1 5-7 10-8" />
      </>
    ),
    cursor: <path d="m5 3 14 9-7 2-3 7z" />,
    database: (
      <>
        <ellipse cx="12" cy="5" rx="7" ry="3" />
        <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </>
    ),
    frame: (
      <>
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
        <path d="M8 12h8" />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    hand: (
      <path d="M7 11V7a1.5 1.5 0 0 1 3 0v3-5a1.5 1.5 0 0 1 3 0v5-4a1.5 1.5 0 0 1 3 0v5-2a1.5 1.5 0 0 1 3 0v4c0 5-3 8-7 8h-1c-2 0-3-1-4-3l-3-4a1.7 1.7 0 0 1 3-2z" />
    ),
    history: (
      <>
        <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" />
        <path d="M4 4v4.6h4.6M12 8v4l3 2" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    logout: (
      <>
        <path d="M10 5H5v14h5M14 8l4 4-4 4M9 12h9" />
      </>
    ),
    note: <path d="M5 4h14v11l-5 5H5zM14 20v-5h5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6.1 9A7 7 0 0 1 18 7l2 5M18 15a7 7 0 0 1-12 2l-2-5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    shield: (
      <path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6l-7-3Zm-3 9 2 2 4-4" />
    ),
    text: (
      <>
        <path d="M5 5h14M12 5v14M8 19h8" />
      </>
    ),
  };

  return (
    <svg {...common} {...props}>
      {paths[name]}
    </svg>
  );
}
