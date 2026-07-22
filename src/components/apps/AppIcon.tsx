// ============================================================
//  App icon system — one crafted vector set, shared by EVERY skin.
//
//  Windows / macOS / iOS / Android all render the same icon: a
//  gradient squircle tile carrying one white monoline glyph, in the
//  iOS / SF Symbols idiom. (Originally only iOS used this and the
//  desktop skins used flat Fluent art, but the squircle set reads
//  better everywhere, so it's now universal.)
//
//  Authored on a 100×100 grid. No external requests, no icon font.
//  Two entry points differ only in default size: `AppIcon` (48px,
//  docks / taskbars / title bars) and `IOSAppIcon` (60px, iOS home
//  screen). Both draw identical artwork.
// ============================================================

import { useId } from "react";

// Apple's icon corner is a superellipse (|x|^n+|y|^n=1, n≈5), not a rounded
// rect — visibly flatter at the corner tangent. Sampled at 96 points on the
// 100×100 grid, which is smooth well past the 60px we ever render at.
const SQUIRCLE =
  "M100 50L99.96 66.8L99.83 72.14L99.61 76.01L99.31 79.12L98.92 81.75L98.44 84.05L97.87 86.08L97.2 87.89L96.44 89.52L95.58 91L94.61 92.33L93.53 93.53L92.33 94.61L91 95.58L89.52 96.44L87.89 97.2L86.08 97.87L84.05 98.44L81.75 98.92L79.12 99.31L76.01 99.61L72.14 99.83L66.8 99.96L50 100L33.2 99.96L27.86 99.83L23.99 99.61L20.88 99.31L18.25 98.92L15.95 98.44L13.92 97.87L12.11 97.2L10.48 96.44L9 95.58L7.67 94.61L6.47 93.53L5.39 92.33L4.42 91L3.56 89.52L2.8 87.89L2.13 86.08L1.56 84.05L1.08 81.75L0.69 79.12L0.39 76.01L0.17 72.14L0.04 66.8L0 50L0.04 33.2L0.17 27.86L0.39 23.99L0.69 20.88L1.08 18.25L1.56 15.95L2.13 13.92L2.8 12.11L3.56 10.48L4.42 9L5.39 7.67L6.47 6.47L7.67 5.39L9 4.42L10.48 3.56L12.11 2.8L13.92 2.13L15.95 1.56L18.25 1.08L20.88 0.69L23.99 0.39L27.86 0.17L33.2 0.04L50 0L66.8 0.04L72.14 0.17L76.01 0.39L79.12 0.69L81.75 1.08L84.05 1.56L86.08 2.13L87.89 2.8L89.52 3.56L91 4.42L92.33 5.39L93.53 6.47L94.61 7.67L95.58 9L96.44 10.48L97.2 12.11L97.87 13.92L98.44 15.95L98.92 18.25L99.31 20.88L99.61 23.99L99.83 27.86L99.96 33.2Z";

// Samsung One UI's app squircle is visibly rounder than Apple's — closer to a
// superellipse with n≈4. Used only on the Android skin (its launcher, dock,
// search and recents) via `round`, so iOS/macOS/Windows keep the n≈5 shape.
const SQUIRCLE_ROUND =
  "M100 50L99.97 61.08L99.88 65.65L99.73 69.15L99.52 72.08L99.25 74.65L98.91 76.94L98.52 79.02L98.06 80.93L97.54 82.69L96.96 84.33L96.31 85.85L95.59 87.27L94.81 88.59L93.96 89.82L93.04 90.97L92.04 92.04L90.97 93.04L89.82 93.96L88.59 94.81L87.27 95.59L85.85 96.31L84.33 96.96L82.69 97.54L80.93 98.06L79.02 98.52L76.94 98.91L74.65 99.25L72.08 99.52L69.15 99.73L65.65 99.88L61.08 99.97L50 100L38.92 99.97L34.35 99.88L30.85 99.73L27.92 99.52L25.35 99.25L23.06 98.91L20.98 98.52L19.07 98.06L17.31 97.54L15.67 96.96L14.15 96.31L12.73 95.59L11.41 94.81L10.18 93.96L9.03 93.04L7.96 92.04L6.96 90.97L6.04 89.82L5.19 88.59L4.41 87.27L3.69 85.85L3.04 84.33L2.46 82.69L1.94 80.93L1.48 79.02L1.09 76.94L0.75 74.65L0.48 72.08L0.27 69.15L0.12 65.65L0.03 61.08L0 50L0.03 38.92L0.12 34.35L0.27 30.85L0.48 27.92L0.75 25.35L1.09 23.06L1.48 20.98L1.94 19.07L2.46 17.31L3.04 15.67L3.69 14.15L4.41 12.73L5.19 11.41L6.04 10.18L6.96 9.03L7.96 7.96L9.03 6.96L10.18 6.04L11.41 5.19L12.73 4.41L14.15 3.69L15.67 3.04L17.31 2.46L19.07 1.94L20.98 1.48L23.06 1.09L25.35 0.75L27.92 0.48L30.85 0.27L34.35 0.12L38.92 0.03L50 0L61.08 0.03L65.65 0.12L69.15 0.27L72.08 0.48L74.65 0.75L76.94 1.09L79.02 1.48L80.93 1.94L82.69 2.46L84.33 3.04L85.85 3.69L87.27 4.41L88.59 5.19L89.82 6.04L90.97 6.96L92.04 7.96L93.04 9.03L93.96 10.18L94.81 11.41L95.59 12.73L96.31 14.15L96.96 15.67L97.54 17.31L98.06 19.07L98.52 20.98L98.91 23.06L99.25 25.35L99.52 27.92L99.73 30.85L99.88 34.35L99.97 38.92Z";

/* Tile gradients, light at the top edge → saturated at the bottom, the way
   Apple's own icons ramp. Spread across the hues so no two apps collide. */
const TINT: Record<string, [string, string]> = {
  // ---- apps ----
  about: ["#5ac8fa", "#0a84ff"],
  resume: ["#ffb340", "#ff7a00"],
  services: ["#ff7a92", "#ff2d55"],
  projects: ["#ffd426", "#ffa000"],
  skills: ["#bf5af2", "#6c2fd9"],
  terminal: ["#4a5058", "#16181c"],
  contact: ["#5ce07f", "#1faa4b"],
  settings: ["#c2c8d2", "#757b86"],
  trash: ["#9aa2ae", "#5c636e"],
  "mission-control": ["#5f6875", "#2e343e"],
  // ---- services (Services app cards) ----
  systems: ["#7f93a8", "#455568"],
  automation: ["#5aa9ff", "#2f6fe4"],
  infrastructure: ["#7bc0ec", "#3f7fb8"],
  realtime: ["#ff8a80", "#d9534a"],
};
const TINT_FALLBACK: [string, string] = ["#9aa3ae", "#5c646f"];

/* White monoline glyphs in the SF Symbols idiom: ~5u strokes on the 100 grid,
   round caps, centred in the tile's optical middle. */
const GLYPH: Record<string, React.ReactNode> = {
  about: (
    <>
      <circle cx="50" cy="40" r="11" fill="#fff" />
      <path d="M29 74c0-11.6 9.4-19 21-19s21 7.4 21 19Z" fill="#fff" />
    </>
  ),
  resume: (
    <>
      <path
        d="M35 20h22l13 13v43a5 5 0 0 1-5 5H35a5 5 0 0 1-5-5V25a5 5 0 0 1 5-5Z"
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M56 20v14h14" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M40 48h20M40 59h20M40 70h12" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  services: (
    <>
      <path d="M40 32v-4a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6v4" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <rect x="24" y="32" width="52" height="42" rx="8" fill="none" stroke="#fff" strokeWidth="5" />
      <path d="M24 49h52" stroke="#fff" strokeWidth="5" />
      <rect x="44" y="43" width="12" height="12" rx="3" fill="#fff" />
    </>
  ),
  projects: (
    <path
      d="M24 32a6 6 0 0 1 6-6h13l7 8h20a6 6 0 0 1 6 6v26a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6Z"
      fill="none"
      stroke="#fff"
      strokeWidth="5"
      strokeLinejoin="round"
    />
  ),
  skills: (
    <>
      <rect x="30" y="30" width="40" height="40" rx="8" fill="none" stroke="#fff" strokeWidth="5" />
      <rect x="42" y="42" width="16" height="16" rx="3" fill="#fff" />
      <path
        d="M40 30V20M50 30V20M60 30V20M40 70v10M50 70v10M60 70v10M30 40H20M30 50H20M30 60H20M70 40h10M70 50h10M70 60h10"
        stroke="#fff"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </>
  ),
  terminal: (
    <>
      <rect x="20" y="24" width="60" height="52" rx="10" fill="none" stroke="#fff" strokeWidth="5" />
      <path d="M33 42l9 8-9 8" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 60h16" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  contact: (
    <>
      <rect x="22" y="32" width="56" height="38" rx="8" fill="none" stroke="#fff" strokeWidth="5" />
      <path d="M25 40l21 15a7 7 0 0 0 8 0l21-15" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  settings: (
    <>
      {/* Teeth start inside the ring's stroke (r≈19) and end just past its outer
          edge, so they read as part of the gear. Start them beyond the ring and
          the whole thing turns into a sun. */}
      <g stroke="#fff" strokeWidth="6.5" strokeLinecap="round">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <path key={a} d="M50 31V24" transform={`rotate(${a} 50 50)`} />
        ))}
      </g>
      <circle cx="50" cy="50" r="19" fill="none" stroke="#fff" strokeWidth="8" />
      <circle cx="50" cy="50" r="7.5" fill="none" stroke="#fff" strokeWidth="4.5" />
    </>
  ),
  trash: (
    <>
      {/* lid bar, then the handle tab that sits on it */}
      <path d="M30 34h40" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path
        d="M42 34v-3.5a5.5 5.5 0 0 1 5.5-5.5h5a5.5 5.5 0 0 1 5.5 5.5V34"
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* the tapering can body, with three ribs */}
      <path
        d="M34.5 34l2.8 38.5a7 7 0 0 0 7 6.5h11.4a7 7 0 0 0 7-6.5L65.5 34"
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M44 45v25M50 45v25M56 45v25" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
    </>
  ),
  // Four spread windows of differing size, the way Mission Control fans the
  // desktop out. Varied opacity gives the front/back layering.
  "mission-control": (
    <>
      <rect x="18" y="20" width="30" height="22" rx="4" fill="#fff" opacity="0.92" />
      <rect x="54" y="20" width="28" height="30" rx="4" fill="#fff" opacity="0.7" />
      <rect x="18" y="50" width="30" height="30" rx="4" fill="#fff" opacity="0.7" />
      <rect x="54" y="58" width="28" height="22" rx="4" fill="#fff" opacity="0.92" />
    </>
  ),

  // ---- services (Services app cards) ----
  systems: (
    <>
      <rect x="26" y="24" width="48" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="4.5" />
      <rect x="26" y="43" width="48" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="4.5" />
      <rect x="26" y="62" width="48" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="4.5" />
      <path d="M63 31h4M63 50h4M63 69h4" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
    </>
  ),
  automation: (
    <path
      d="M55 20L32 55h15l-4 25 26-38H57Z"
      fill="none"
      stroke="#fff"
      strokeWidth="5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  ),
  infrastructure: (
    <>
      <ellipse cx="50" cy="32" rx="24" ry="9" fill="none" stroke="#fff" strokeWidth="5" />
      <path d="M26 32v36c0 5 10.7 9 24 9s24-4 24-9V32" fill="none" stroke="#fff" strokeWidth="5" />
      <path d="M26 50c0 5 10.7 9 24 9s24-4 24-9" fill="none" stroke="#fff" strokeWidth="5" />
    </>
  ),
  realtime: (
    <path
      d="M22 52h13l7-16 12 30 8-20 5 6h13"
      fill="none"
      stroke="#fff"
      strokeWidth="5.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

const GLYPH_FALLBACK: React.ReactNode = (
  <>
    <rect x="32" y="24" width="36" height="52" rx="6" fill="none" stroke="#fff" strokeWidth="5" />
    <path d="M42 40h16M42 52h16M42 64h10" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
  </>
);

interface AppIconProps {
  /** app or service id */
  id: string;
  /** rendered size in px */
  size?: number;
  /** kept for call-site compatibility; icons are free-form and ignore it */
  radius?: number;
  /** use Samsung One UI's rounder squircle (Android skin only) */
  round?: boolean;
  /** layered gloss / bevel so the tile reads as 3-D glass (macOS Dock) */
  depth?: boolean;
  className?: string;
}

/* The three overlays that turn a flat squircle into a rounded piece of glass:
   a specular sheen across the top, an inner shadow pooling at the bottom, and
   a bright rim caught along the top edge. All clipped to the tile shape by the
   caller. Ids are passed in so each instance keeps its own gradients. */
function DepthDefs({ gloss, shade, rim }: { gloss: string; shade: string; rim: string }) {
  return (
    <>
      <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
        <stop offset="0.4" stopColor="#fff" stopOpacity="0.07" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={shade} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.55" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.3" />
      </linearGradient>
      <linearGradient id={rim} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
        <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </>
  );
}

/* Finder — macOS's permanent first Dock app. Two faces meet: a blue side-profile
   on the left, a white front-face on the right, and the SEAM between them is the
   profile itself — brow, a nose that juts left, then down past the lip to the
   chin. Both eyes and the smile are one dark ink across both faces (not tinted
   per side), and the profile casts a soft shadow onto the white. Same squircle
   tile as every other icon. Rendered by id ("finder") so the Dock tile and the
   window title bar share one source. */
// Every line below is Apple's own geometry, mapped off the 24-grid reference
// onto our 100-grid: the reference frame spans 1.5→22.5, so x100 = (x24-1.5)*100/21.
//
// The seam IS the profile, and its shape is one long unbroken sweep — from the
// top edge (x52.4) the forehead and brow bow left the whole way down to the
// nose tip at x40.5, with no bump or wiggle en route. The nose's underside is a
// flat shelf running back right to x52.8, then the jaw curves gently out to the
// chin at x59.5. The two shelf corners are eased ~2 units because the reference
// draws this stroke with linejoin=round. FACE reuses SEAM verbatim, so the cast
// shadow tracks the edge exactly.
const FINDER_SEAM =
  "M52.4 0 C48.4 9.5 40.5 34.3 40.5 55.1 Q40.5 57.1 42.5 57.1 L52.8 57.1 Q54.8 57.1 54.8 59.1 C54.8 70.5 55.8 88.9 59.5 100";
const FINDER_FACE = `${FINDER_SEAM} L100 100 L100 0 Z`;

function FinderIcon({
  size,
  className,
  uid,
  depth,
}: {
  size: number;
  className?: string;
  uid: string;
  depth?: boolean;
}) {
  const bg = `finder-bg-${uid}`;
  const wt = `finder-wt-${uid}`;
  const sq = `finder-sq-${uid}`;
  const wc = `finder-wc-${uid}`;
  const gloss = `finder-gloss-${uid}`;
  const shade = `finder-shade-${uid}`;
  const rim = `finder-rim-${uid}`;
  const ink = "#38383b";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#19b2f5" />
          <stop offset="0.5" stopColor="#1f8ef2" />
          <stop offset="1" stopColor="#2567ee" />
        </linearGradient>
        <linearGradient id={wt} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdfefe" />
          <stop offset="1" stopColor="#e3e7ec" />
        </linearGradient>
        <clipPath id={sq}>
          <path d={SQUIRCLE} />
        </clipPath>
        <clipPath id={wc}>
          <path d={FINDER_FACE} />
        </clipPath>
        {depth && <DepthDefs gloss={gloss} shade={shade} rim={rim} />}
      </defs>
      <g clipPath={`url(#${sq})`}>
        <rect width="100" height="100" fill={`url(#${bg})`} />
        <path d={FINDER_FACE} fill={`url(#${wt})`} />
        {/* the profile's soft shadow, clipped so it falls only on the white face */}
        <g clipPath={`url(#${wc})`}>
          <path d={FINDER_SEAM} fill="none" stroke="#7f8b99" strokeWidth="2.8" opacity="0.22" />
        </g>
        {/* volume goes under the ink so the eyes and smile stay crisp */}
        {depth && <rect width="100" height="100" fill={`url(#${shade})`} />}
        {depth && <rect width="100" height="100" fill={`url(#${gloss})`} />}
        {/* eyes centred on x23.8/x71.4 — the reference's round-capped bars, drawn
            as capsules so the cap radius is exact. A touch heavier than a literal
            1-unit stroke so they still read at 48px in the Dock. */}
        <rect x="21.1" y="25.9" width="5.4" height="14.9" rx="2.7" fill={ink} />
        <rect x="68.7" y="25.9" width="5.4" height="14.9" rx="2.7" fill={ink} />
        {/* smile: wide and flat-bottomed, running x19→x81 and levelling off at y81 */}
        <path
          d="M19 66.7 C22.2 71.4 32.9 81 50 81 C67.1 81 77 71.4 81 66.7"
          fill="none"
          stroke={ink}
          strokeWidth="5.6"
          strokeLinecap="round"
        />
        {depth && <path d={SQUIRCLE} fill="none" stroke={`url(#${rim})`} strokeWidth="1.6" />}
      </g>
    </svg>
  );
}

/**
 * The shared icon: gradient squircle + white glyph, one <svg> so
 * originZoom's `iconBox` still measures the artwork exactly (it grabs the
 * first <svg> inside the launcher button).
 */
function SquircleIcon({
  id,
  size,
  className,
  round,
  depth,
}: {
  id: string;
  size: number;
  className?: string;
  round?: boolean;
  depth?: boolean;
}) {
  // Several of these can be on screen at once (grid + nav title, dock + window
  // title), so the gradient id has to be per-instance or a later one silently
  // reuses the first's gradient.
  const uid = useId();
  if (id === "finder") return <FinderIcon size={size} className={className} uid={uid} depth={depth} />;
  const gid = `app-tint-${uid}`;
  const [from, to] = TINT[id] ?? TINT_FALLBACK;
  const shape = round ? SQUIRCLE_ROUND : SQUIRCLE;
  const glyph = GLYPH[id] ?? GLYPH_FALLBACK;

  const tint = (
    <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={from} />
      <stop offset="1" stopColor={to} />
    </linearGradient>
  );

  // Flat variant — the shared default for iOS / Windows / Android launchers.
  if (!depth) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={className}
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <defs>{tint}</defs>
        <path d={shape} fill={`url(#${gid})`} />
        {glyph}
      </svg>
    );
  }

  // 3-D variant — the tint gets a bottom inner shadow (volume) and a top
  // specular sheen under the glyph, then a bright rim traces the top edge.
  const clipId = `app-clip-${uid}`;
  const gloss = `app-gloss-${uid}`;
  const shade = `app-shade-${uid}`;
  const rim = `app-rim-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {tint}
        <DepthDefs gloss={gloss} shade={shade} rim={rim} />
        <clipPath id={clipId}>
          <path d={shape} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="100" height="100" fill={`url(#${gid})`} />
        <rect width="100" height="100" fill={`url(#${shade})`} />
        <rect width="100" height="100" fill={`url(#${gloss})`} />
        {glyph}
        <path d={shape} fill="none" stroke={`url(#${rim})`} strokeWidth="1.6" />
      </g>
    </svg>
  );
}

/** App icon for launchers, docks, taskbars, title bars, Services cards. */
export function AppIcon({ id, size = 48, className, round, depth }: AppIconProps) {
  return <SquircleIcon id={id} size={size} className={className} round={round} depth={depth} />;
}

/** iOS home-screen / dock variant — identical art, just a larger default size. */
export function IOSAppIcon({ id, size = 60, className }: AppIconProps) {
  return <SquircleIcon id={id} size={size} className={className} />;
}
