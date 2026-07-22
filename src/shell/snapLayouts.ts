// Windows 11 snap-layout definitions. Each layout is a list of zones given as
// fractions of the work area; the flyout renders them as miniature previews
// and the window manager converts the chosen zone to pixels.

export interface SnapZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const SNAP_LAYOUTS: SnapZone[][] = [
  // two halves
  [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 1 },
  ],
  // wide left / narrow right
  [
    { x: 0, y: 0, w: 2 / 3, h: 1 },
    { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
  ],
  // three columns
  [
    { x: 0, y: 0, w: 1 / 3, h: 1 },
    { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
    { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
  ],
  // wide centre
  [
    { x: 0, y: 0, w: 0.25, h: 1 },
    { x: 0.25, y: 0, w: 0.5, h: 1 },
    { x: 0.75, y: 0, w: 0.25, h: 1 },
  ],
  // left half + right stacked
  [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  // quarters
  [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
];
