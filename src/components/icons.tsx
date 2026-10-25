type P = { className?: string; size?: number };

function Svg({
  size = 20,
  className,
  children,
  fill = "none",
}: P & { children: React.ReactNode; fill?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={fill === "none" ? "currentColor" : "none"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Svg>
);
export const IconBall = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z" />
    <path d="M12 3v4.5M15.6 10.1l4.8-1.6M14.2 14.3l2.9 4.1M9.8 14.3l-2.9 4.1M8.4 10.1L3.6 8.5" />
  </Svg>
);
export const IconTrophy = (p: P) => (
  <Svg {...p}>
    <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
    <path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" />
    <path d="M12 13v3M8.5 20h7M9.5 16.5h5V20h-5z" />
  </Svg>
);
export const IconTrophyFill = (p: P) => (
  <Svg {...p} fill="currentColor">
    <path d="M6 3h12v5.5a6 6 0 0 1-4.6 5.84V16h2.1a1 1 0 0 1 1 1v3H7.5v-3a1 1 0 0 1 1-1h2.1v-1.66A6 6 0 0 1 6 8.5zM3 5h2.2v3.2c0 .9.15 1.77.42 2.58A4 4 0 0 1 3 7zm18 0v2a4 4 0 0 1-2.62 3.78c.27-.81.42-1.68.42-2.58V5z" />
  </Svg>
);
export const IconWhats = (p: P) => (
  <Svg {...p} fill="currentColor">
    <path d="M12 2a10 10 0 0 0-8.66 15l-1.3 4.76 4.88-1.28A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.18 15.25l-.3-.18-2.9.76.78-2.83-.2-.31A8.2 8.2 0 0 1 12 3.8zm-3.3 4.1c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.07 3.3 5.1 4.5 2.52 1 3.03.8 3.58.75.55-.05 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.95 1.17-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.66-1.63-.92-2.23-.24-.58-.48-.5-.67-.5z" />
  </Svg>
);
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
);
export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M9 18l6-6-6-6" />
  </Svg>
);
export const IconExpand = (p: P) => (
  <Svg {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Svg>
);
export const IconCompress = (p: P) => (
  <Svg {...p}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </Svg>
);
export const IconPlay = (p: P) => (
  <Svg {...p} fill="currentColor">
    <path d="M7 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" />
  </Svg>
);
export const IconPin = (p: P) => (
  <Svg {...p}>
    <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </Svg>
);
export const IconUsers = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconWallet = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 9h18M16 14h2" />
  </Svg>
);
export const IconFlame = (p: P) => (
  <Svg {...p}>
    <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2.5 2 3 0-3 0-5.5 1-8.5z" />
  </Svg>
);
export const IconGift = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M5 12v8h14v-8M12 8v12M12 8S10.5 4 8 4a2 2 0 0 0 0 4M12 8s1.5-4 4-4a2 2 0 0 1 0 4" />
  </Svg>
);
export const IconUserPlus = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="8" r="4" />
    <path d="M3 20a7 7 0 0 1 14 0M19 8v6M16 11h6" />
  </Svg>
);
export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
);
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export function IconCrown(p: P) {
  return (
    <Svg {...p}>
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" />
    </Svg>
  );
}

export function IconRefresh(p: P) {
  return (
    <Svg {...p}>
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" />
    </Svg>
  );
}
