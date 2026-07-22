import type { AppMeta } from "./types";

// The app registry. Every OS skin (Windows / macOS / iOS / Android) reads this
// same list to build its launcher, dock, or home-screen grid. Add an app once
// here and it appears everywhere.

export const apps: AppMeta[] = [
  {
    id: "about",
    title: "About Me",
    icon: "👋",
    category: "primary",
    // Two-column identity-rail + bio; columns stack on a container query when
    // the window is dragged narrower than ~600px (and on phone skins).
    defaultSize: { w: 720, h: 560 },
  },
  {
    id: "resume",
    title: "Resume",
    icon: "📄",
    category: "primary",
    defaultSize: { w: 640, h: 620 },
  },
  {
    id: "services",
    title: "Services",
    icon: "🧩",
    category: "primary",
    defaultSize: { w: 620, h: 560 },
  },
  {
    id: "projects",
    title: "Projects",
    icon: "🗂️",
    category: "primary",
    defaultSize: { w: 680, h: 560 },
  },
  {
    id: "skills",
    title: "Skills",
    icon: "🧠",
    category: "primary",
    defaultSize: { w: 560, h: 520 },
  },
  {
    id: "terminal",
    title: "Terminal",
    icon: "⌨️",
    category: "primary",
    defaultSize: { w: 640, h: 440 },
  },
  {
    id: "contact",
    title: "Contact",
    icon: "✉️",
    category: "primary",
    // Wide enough for the two-column hub layout; the columns collapse on a
    // container query if the visitor resizes it narrower than ~720px.
    defaultSize: { w: 900, h: 640 },
  },
  {
    id: "settings",
    title: "Settings",
    icon: "⚙️",
    category: "system",
    defaultSize: { w: 560, h: 480 },
  },
];

// macOS-only apps. These are resolvable by `getApp` — so their windows get a
// title, icon and default size like any other — but are deliberately kept OUT
// of `apps` above, the list every launcher maps over. Finder has no meaning on
// Windows / iOS / Android, and only the Mac Dock ever opens it, so this keeps it
// off every other skin's home screen, Start menu and search without a filter.
const macOnlyApps: AppMeta[] = [
  {
    id: "finder",
    title: "Finder",
    icon: "🙂",
    category: "system",
    defaultSize: { w: 720, h: 480 },
  },
];

export function getApp(id: string): AppMeta | undefined {
  return apps.find((a) => a.id === id) ?? macOnlyApps.find((a) => a.id === id);
}
