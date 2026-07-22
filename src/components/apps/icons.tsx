// Inline SVG icons — no external requests, no icon font. Used by contact links
// and app chrome. Kept tiny and monochrome (currentColor).

interface Props {
  name: string;
  size?: number;
}

const paths: Record<string, React.ReactNode> = {
  email: <path d="M2 5h20v14H2z M2 5l10 7 10-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  github: (
    <path
      d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"
      fill="currentColor"
    />
  ),
  linkedin: (
    <path
      d="M4.98 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.75V21h-4v-4.9c0-1.17-.02-2.67-1.7-2.67-1.7 0-1.96 1.27-1.96 2.58V21h-4z"
      fill="currentColor"
    />
  ),
  x: <path d="M18.9 2H22l-7.5 8.6L23 22h-6.8l-5-6.6L5.5 22H2.4l8-9.2L1.5 2h7l4.5 6zM17 20h1.7L7 4H5.2z" fill="currentColor" />,
  website: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 0c3 3 3 17 0 20M12 2c-3 3-3 17 0 20M2.5 9h19M2.5 15h19" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  resume: <path d="M6 2h9l5 5v15H6z M15 2v5h5 M9 12h6 M9 16h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />,
  external: <path d="M7 17 17 7 M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,

  // contact app — inquiry categories, form chrome, and info rows
  briefcase: <path d="M3 8h18v12H3z M8 8V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V8 M3 13h18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />,
  userPlus: <path d="M15 20v-1.6a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20 M8.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7 M18.5 7v6 M21.5 10h-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />,
  gitFork: <path d="M6.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5 M17.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5 M12 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5 M6.5 8v2a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V8 M12 12v4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />,
  smile: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M8.5 14s1.3 1.6 3.5 1.6 3.5-1.6 3.5-1.6 M9 9.5h.01 M15 9.5h.01" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />,
  send: <path d="M21.5 2.5 2.5 10.2l7.3 2.9 2.9 7.3z M21.5 2.5 9.8 13.1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />,
  check: <path d="m4.5 12.5 5 5 10-10" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
  spinner: <path d="M12 3v3.5 M12 17.5V21 M21 12h-3.5 M6.5 12H3 M18.4 5.6l-2.5 2.5 M8.1 15.9l-2.5 2.5 M18.4 18.4l-2.5-2.5 M8.1 8.1 5.6 5.6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />,
  mapPin: <path d="M20 10.5c0 5.5-8 11-8 11s-8-5.5-8-11a8 8 0 1 1 16 0Z M12 13a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 7v5.2l3.2 2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />,
  alert: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 7.8v5 M12 16.2h.01" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />,
  chevronDown: <path d="m5 9 7 7 7-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
};

export function Icon({ name, size = 18 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name] ?? null}
    </svg>
  );
}
