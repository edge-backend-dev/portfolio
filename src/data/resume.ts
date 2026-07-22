import type { Resume } from "./types";

// The experience below reflects real, independent product-engineering work.
// Period is year-only ("2025 – Present") on purpose — honest, without foregrounding
// exact tenure. No education section: only WAEC so far, no degree yet (see below).

export const resume: Resume = {
  summary:
    "AI Product Engineer who ships complex, production-grade systems fast. Comfortable across the full stack and the edge — from React front ends to custom backends, real-time media, and AI automation pipelines.",
  experience: [
    {
      role: "AI Product Engineer — Independent",
      org: "Self-directed product work",
      period: "2025 – Present",
      points: [
        "Design and build complex web apps, systems, and websites end to end, delivering in 1–4 week iteration cycles.",
        "Built a custom backend-and-database platform (BaaS) from scratch to power my products — auth, storage, and edge APIs on Cloudflare Workers and R2.",
        "Building a real-time meeting product (video/voice) on a selective-forwarding architecture rather than peer mesh, for scale.",
        "Design AI automation pipelines that replace repetitive manual workflows so teams can reallocate attention and time.",
      ],
      tags: ["TypeScript", "React", "Cloudflare", "AI Automation", "Realtime"],
    },
  ],
  // No education section: only WAEC so far, no degree yet — so the section is
  // omitted rather than padded. Add an `education: [...]` array here later if a
  // real credential is worth listing; the UI shows the section only when present.
  // Interim PDF (public/resume.pdf) built from the real content above — safe if
  // downloaded, since it contains no placeholders. Replace that file with your
  // own polished resume when ready; this path stays the same.
  pdfUrl: "/resume.pdf",
};
