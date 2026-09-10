import type { SVGProps } from "react";

export type IconName =
  | "board"
  | "check"
  | "chevron"
  | "clock"
  | "connector"
  | "cursor"
  | "frame"
  | "grid"
  | "hand"
  | "layers"
  | "note"
  | "search"
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
    board: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 4v16M8 9h13" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
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
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    note: <path d="M5 4h14v11l-5 5H5zM14 20v-5h5" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
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
