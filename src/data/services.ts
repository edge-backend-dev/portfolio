import type { Service } from "./types";

export const services: Service[] = [
  {
    id: "systems",
    title: "Complex Systems & Web Apps",
    pitch: "Production-grade apps and systems, built end to end and shipped in 1–4 weeks.",
    points: [
      "Full-stack builds: front end, backend, data model, and deployment.",
      "Iterative delivery — you see progress continuously and steer as we go.",
      "Built to scale, not just to demo.",
    ],
    icon: "🧩",
  },
  {
    id: "automation",
    title: "AI Automation",
    pitch: "Hand the repetitive, manual work to reliable systems so your team focuses on what needs a human.",
    points: [
      "Automate the workflows that quietly eat hours every week.",
      "Free human attention for judgment calls, relationships, and creative work.",
      "Give people back time — for the business and for themselves.",
    ],
    icon: "🤖",
  },
  {
    id: "infrastructure",
    title: "Custom Backend & Database",
    pitch: "Apps built on a custom backend and database I built and run myself.",
    points: [
      "Auth, storage, and APIs on modern edge infrastructure.",
      "No black-box vendor lock-in — infrastructure I understand end to end.",
      "Reliable foundations that your product can grow on.",
    ],
    icon: "🗄️",
  },
  {
    id: "realtime",
    title: "Real-Time Features",
    pitch: "Live video, voice, and collaborative experiences engineered to scale.",
    points: [
      "Real-time media built on selective forwarding, not fragile peer mesh.",
      "Presence, live rosters, and collaborative state.",
      "Architected for many participants, not just a two-person demo.",
    ],
    icon: "📡",
  },
];
