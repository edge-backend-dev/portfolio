import type { Project } from "./types";

// Real project case studies are added here ONLY when a project is finished and
// you've said to add it. Until then this stays empty and the Projects app shows
// locked "coming soon" tiles. When ready, push an entry like:
//
//   {
//     id: "meeting-app",
//     title: "Realtime Meeting App",
//     status: "live",
//     summary: "Google-Meet-style video & voice on a selective-forwarding SFU.",
//     description: ["…"],
//     tags: ["React", "Cloudflare Realtime", "WebRTC"],
//     links: [{ label: "Live", href: "https://…" }],
//     locked: false,
//   }
//
export const projects: Project[] = [];

// Number of locked placeholder tiles to show while the case-study list is empty.
export const PLACEHOLDER_SLOTS = 4;
