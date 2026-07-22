import type { SkillGroup } from "./types";

// Technologies drawn from your actual project stack. Trim anything you'd rather
// not list; this feeds both the Skills app and the Terminal app.

export const skills: SkillGroup[] = [
  {
    category: "Languages",
    items: ["TypeScript", "JavaScript", "SQL", "HTML", "CSS"],
  },
  {
    category: "Frontend",
    items: ["React 19", "Astro", "Tailwind CSS", "Vite"],
  },
  {
    category: "Backend & Edge",
    items: ["Hono", "Cloudflare Workers", "Cloudflare Pages", "REST APIs", "Better Auth"],
  },
  {
    category: "Data & Storage",
    items: ["PostgreSQL (Neon)", "Cloudflare D1", "Drizzle ORM", "Cloudflare R2"],
  },
  {
    category: "Realtime & Media",
    items: ["Realtime SFU", "WebRTC", "Live presence"],
  },
  {
    category: "AI & Automation",
    items: ["LLM integration", "AI workflow automation", "Conversational interfaces"],
  },
];
