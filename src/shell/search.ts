import { apps } from "../data/apps";
import { profile } from "../data/profile";
import { projects } from "../data/projects";
import { resume } from "../data/resume";
import { services } from "../data/services";
import { skills } from "../data/skills";

// One search index over every content file, shared by macOS Spotlight and the
// Windows Start menu so both skins search the same thing. Entries are derived
// from the data modules, so adding a project or a skill makes it findable with
// no change here.

export type SearchGroup = "Applications" | "Projects" | "Skills" | "Services" | "Resume" | "Contact";

/** group ordering when scores tie — mirrors how much a visitor likely wants it */
const GROUP_RANK: Record<SearchGroup, number> = {
  Applications: 0,
  Projects: 1,
  Services: 2,
  Skills: 3,
  Resume: 4,
  Contact: 5,
};

export interface SearchEntry {
  key: string;
  /** app the result opens */
  appId: string;
  group: SearchGroup;
  title: string;
  subtitle: string;
  /** matched but not displayed; substring-only so long prose can't fuzzy-match everything */
  keywords: string[];
}

export interface SearchHit extends SearchEntry {
  score: number;
}

// Content files mark unfinished fields as ⟨placeholder⟩. Those must never
// surface as results — searching "role" shouldn't return "⟨Role / Title⟩".
const isPlaceholder = (s: string) => s.includes("⟨");

function buildIndex(): SearchEntry[] {
  const out: SearchEntry[] = [];

  for (const a of apps) {
    out.push({
      key: `app:${a.id}`,
      appId: a.id,
      group: "Applications",
      title: a.title,
      subtitle: a.category === "system" ? "System app" : "Application",
      // let an app be found by what it holds, not just its name
      keywords: a.id === "about" ? [a.id, profile.role, profile.tagline] : [a.id],
    });
  }

  for (const p of projects) {
    out.push({
      key: `project:${p.id}`,
      appId: "projects",
      group: "Projects",
      title: p.title,
      subtitle: p.summary,
      keywords: [...(p.tags ?? []), p.status],
    });
  }

  for (const s of services) {
    out.push({
      key: `service:${s.id}`,
      appId: "services",
      group: "Services",
      title: s.title,
      subtitle: s.pitch,
      keywords: s.points,
    });
  }

  for (const g of skills) {
    for (const item of g.items) {
      out.push({
        key: `skill:${g.category}:${item}`,
        appId: "skills",
        group: "Skills",
        title: item,
        subtitle: g.category,
        keywords: [g.category],
      });
    }
  }

  for (const e of resume.experience) {
    if (isPlaceholder(e.role) || isPlaceholder(e.org)) continue;
    out.push({
      key: `exp:${e.role}`,
      appId: "resume",
      group: "Resume",
      title: e.role,
      subtitle: `${e.org} · ${e.period}`,
      keywords: [...(e.tags ?? []), ...e.points],
    });
  }
  for (const e of resume.education ?? []) {
    if (isPlaceholder(e.credential) || isPlaceholder(e.org)) continue;
    out.push({
      key: `edu:${e.credential}`,
      appId: "resume",
      group: "Resume",
      title: e.credential,
      subtitle: `${e.org} · ${e.period}`,
      keywords: e.note ? [e.note] : [],
    });
  }

  for (const l of profile.links) {
    if (isPlaceholder(l.href)) continue;
    out.push({
      key: `link:${l.label}`,
      appId: "contact",
      group: "Contact",
      title: l.label,
      subtitle: l.handle ?? l.href,
      keywords: [l.icon],
    });
  }

  return out;
}

// Built once on first search: the data modules are static imports, so the index
// can never go stale within a session.
let index: SearchEntry[] | null = null;

/**
 * Score `query` against one field. Earlier and more word-aligned matches win.
 * `fuzzy` enables subsequence matching ("prj" → "Projects"); it's reserved for
 * short fields like titles, since on prose it would match almost anything.
 */
function scoreText(q: string, text: string, fuzzy: boolean): number {
  const t = text.toLowerCase();
  const i = t.indexOf(q);
  if (i === 0) return 100;
  if (i > 0) return /[a-z0-9]/.test(t[i - 1]) ? 55 : 80; // mid-word match ranks below a word start
  return fuzzy ? subsequence(q, t) : 0;
}

/** all of `q` appears in order in `t`; tighter and earlier runs score higher */
function subsequence(q: string, t: string): number {
  let from = 0;
  let gaps = 0;
  let first = -1;
  for (const ch of q) {
    const at = t.indexOf(ch, from);
    if (at < 0) return 0;
    if (first < 0) first = at;
    else gaps += at - from;
    from = at + 1;
  }
  // An abbreviation someone actually typed is compact: "prj" → "Projects".
  // Letters merely scattered across a phrase ("role" → "conversational
  // interfaces") are coincidence, not intent, so drop them entirely.
  if (gaps > q.length) return 0;
  return Math.max(4, 40 - gaps * 2 - first);
}

function scoreEntry(q: string, e: SearchEntry): number {
  let best = scoreText(q, e.title, true);
  best = Math.max(best, scoreText(q, e.subtitle, false) * 0.4);
  for (const k of e.keywords) best = Math.max(best, scoreText(q, k, false) * 0.5);
  return best;
}

/** Ranked hits for `query`; empty for a blank query. */
export function search(query: string, limit = 8): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (!index) index = buildIndex();

  return index
    .map((e) => ({ ...e, score: scoreEntry(q, e) }))
    .filter((h) => h.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        GROUP_RANK[a.group] - GROUP_RANK[b.group] ||
        a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

/** Hits bucketed by group, preserving rank order within and across groups. */
export function groupHits(hits: SearchHit[]): { group: SearchGroup; hits: SearchHit[] }[] {
  const out: { group: SearchGroup; hits: SearchHit[] }[] = [];
  for (const h of hits) {
    const bucket = out.find((g) => g.group === h.group);
    if (bucket) bucket.hits.push(h);
    else out.push({ group: h.group, hits: [h] });
  }
  return out;
}
