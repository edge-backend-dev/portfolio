// Shared content types. All portfolio copy lives in typed data files so the
// visual shell (Phases 1–6) never has to be touched when content changes.

export interface SocialLink {
  label: string;
  href: string;
  handle?: string;
  /** icon key resolved by the UI layer (inline SVG, no external requests) */
  icon: "email" | "github" | "linkedin" | "x" | "website" | "resume";
}

export interface Profile {
  name: string;
  role: string;
  tagline: string;
  location: string;
  /** short one-liner for cards / meta */
  summary: string;
  /** long-form bio paragraphs */
  bio: string[];
  availability: {
    open: boolean;
    /** capacity + how long projects take */
    note: string;
    /** how soon an email gets answered — a promise, so keep it conservative */
    replyTime: string;
  };
  email: string;
  links: SocialLink[];
}

export interface ExperienceEntry {
  role: string;
  org: string;
  period: string;
  location?: string;
  points: string[];
  tags?: string[];
}

export interface EducationEntry {
  credential: string;
  org: string;
  period: string;
  note?: string;
}

export interface Resume {
  summary: string;
  experience: ExperienceEntry[];
  /** omit entirely when there's no formal education to list — the UI hides the
   *  section rather than showing an empty or placeholder entry */
  education?: EducationEntry[];
  /** optional link to a downloadable PDF; empty string = hide button */
  pdfUrl: string;
}

export interface Service {
  id: string;
  title: string;
  pitch: string;
  points: string[];
  icon: string; // emoji fallback until Phase 1 icon set
}

export interface SkillGroup {
  category: string;
  items: string[];
}

export type ProjectStatus = "live" | "in-progress" | "coming-soon";

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  summary: string;
  /** long description, shown when a project is unlocked */
  description?: string[];
  tags?: string[];
  links?: { label: string; href: string }[];
  /** when true, the card renders locked with no detail — used until a project ships */
  locked: boolean;
}

export interface AppMeta {
  id: string;
  title: string;
  /** emoji icon fallback; replaced with per-OS icon art later */
  icon: string;
  /** grouping hint for launchers */
  category: "primary" | "system";
  /** default window size on desktop skins (px) */
  defaultSize?: { w: number; h: number };
}
