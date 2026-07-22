import { useEffect, useMemo, useRef, useState } from "react";
import { apps } from "../../../data/apps";
import { search as runSearch, groupHits } from "../../../shell/search";
import { AppIcon } from "../../apps/AppIcon";

interface Props {
  onOpen: (id: string, from: HTMLElement) => void;
  onClose: () => void;
}

const RECENTS_KEY = "portfolio:and-recent-search";
const RECENTS_MAX = 6;

type IconName = "spark" | "code" | "cloud" | "bolt" | "hash" | "doc";

// Quick-search topics. Each label is a real query against the shared index, so
// tapping a chip runs a genuine search rather than opening a canned page.
const TOPICS: { label: string; icon: IconName }[] = [
  { label: "AI", icon: "spark" },
  { label: "React", icon: "code" },
  { label: "Cloudflare", icon: "cloud" },
  { label: "Automation", icon: "bolt" },
  { label: "TypeScript", icon: "hash" },
  { label: "Resume", icon: "doc" },
];

// Full-screen One UI "Finder" search. Idle, it shows suggested apps, explore
// chips, quick cards and recent searches; typing swaps in live grouped results
// from the shared content index (the same one macOS Spotlight and Windows Start
// use), so a result opens the app that holds the match.
export default function AndroidSearch({ onOpen, onClose }: Props) {
  const [q, setQ] = useState("");
  const [recents, setRecents] = useState<string[]>(() => loadRecents());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hits = useMemo(() => runSearch(q, 20), [q]);
  const groups = useMemo(() => groupHits(hits), [hits]);
  const typing = q.trim() !== "";

  // Persist synchronously (not inside the setState updater): opening a result
  // unmounts this screen in the same batch, and a pending updater's side effect
  // would be dropped — so write to storage first, then update the UI.
  function commit(term: string) {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recents.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, RECENTS_MAX);
    saveRecents(next);
    setRecents(next);
  }

  // Opening a result also records the query as a recent search, One UI style.
  function openHit(appId: string, el: HTMLElement) {
    commit(q);
    onOpen(appId, el);
  }

  function removeRecent(term: string) {
    const next = recents.filter((x) => x !== term);
    saveRecents(next);
    setRecents(next);
  }

  function clearRecents() {
    setRecents([]);
    saveRecents([]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && hits.length > 0) openHit(hits[0].appId, e.currentTarget);
    else if (e.key === "Escape") onClose();
  }

  return (
    <div className="and-search-screen" role="dialog" aria-label="Search">
      <div className="and-search-scroll">
        {typing ? (
          groups.length === 0 ? (
            <div className="and-search-empty">No results for &ldquo;{q.trim()}&rdquo;.</div>
          ) : (
            <div className="and-search-results">
              {groups.map((g) => (
                <div key={g.group} className="and-search-group">
                  <div className="and-search-group-title">{g.group}</div>
                  {g.hits.map((h) => (
                    <button
                      key={h.key}
                      className="and-search-hit"
                      onClick={(e) => openHit(h.appId, e.currentTarget)}
                    >
                      <AppIcon id={h.appId} size={40} round className="and-search-hit-icon" />
                      <span className="and-search-hit-text">
                        <span className="and-search-hit-title">{h.title}</span>
                        <span className="and-search-hit-sub">{h.subtitle}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            {/* Suggested apps */}
            <section className="and-fcard">
              <h2 className="and-fcard-title">Suggested apps</h2>
              <div className="and-fapps">
                {apps.map((a) => (
                  <button
                    key={a.id}
                    className="and-fapp"
                    onClick={(e) => onOpen(a.id, e.currentTarget)}
                  >
                    <AppIcon id={a.id} size={52} round className="and-fapp-icon" />
                    <span className="and-fapp-label">{a.title}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Explore — tap a chip to run that search */}
            <section className="and-fcard">
              <h2 className="and-fcard-title">Explore</h2>
              <div className="and-fchips">
                {TOPICS.map((t) => (
                  <button key={t.label} className="and-fchip" onClick={() => setQ(t.label)}>
                    <TopicIcon name={t.icon} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Two quick cards — the portfolio's showcase + CTA */}
            <div className="and-fquick">
              <button
                className="and-fquick-card"
                onClick={(e) => onOpen("projects", e.currentTarget)}
              >
                <span className="and-fquick-ic is-projects">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="and-fquick-label">Projects</span>
              </button>
              <button
                className="and-fquick-card"
                onClick={(e) => onOpen("contact", e.currentTarget)}
              >
                <span className="and-fquick-ic is-contact">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="5" width="18" height="14" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
                    <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="and-fquick-label">Contact</span>
              </button>
            </div>

            {/* Recent searches */}
            {recents.length > 0 && (
              <section className="and-fcard">
                <div className="and-fcard-head">
                  <h2 className="and-fcard-title">Recent searches</h2>
                  <button className="and-fclear" onClick={clearRecents}>
                    Clear all
                  </button>
                </div>
                <div className="and-fchips">
                  {recents.map((term) => (
                    <span key={term} className="and-fchip is-recent">
                      <button className="and-frecent-run" onClick={() => setQ(term)}>
                        {term}
                      </button>
                      <button
                        className="and-frecent-x"
                        onClick={() => removeRecent(term)}
                        aria-label={`Remove ${term}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Bottom search bar — One UI's one-handed, keyboard-adjacent placement */}
      <div className="and-search-bar">
        <svg className="and-search-bar-ic" width="21" height="21" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.6-3.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          className="and-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search"
          aria-label="Search query"
        />
        {q ? (
          <button className="and-search-clear" onClick={() => setQ("")} aria-label="Clear search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <span className="and-search-mic" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
        )}
        <span className="and-search-more" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="12" cy="19" r="1.7" />
          </svg>
        </span>
      </div>
    </div>
  );
}

function TopicIcon({ name }: { name: IconName }) {
  const s = {
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "spark":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 4l1.7 4.6L18 10l-4.3 1.4L12 16l-1.7-4.6L6 10l4.3-1.4z" {...s} />
        </svg>
      );
    case "code":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" {...s} />
        </svg>
      );
    case "cloud":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M7 18h9a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 7 10a4 4 0 0 0 0 8z" {...s} />
        </svg>
      );
    case "bolt":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M13 3 5 13h5l-1 8 8-11h-5z" {...s} />
        </svg>
      );
    case "hash":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M9 4 7 20M17 4l-2 16M5 9h15M4 15h15" {...s} />
        </svg>
      );
    case "doc":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M7 3h7l4 4v14H7zM14 3v4h4" {...s} />
        </svg>
      );
  }
}

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecents(list: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable — recents just won't persist */
  }
}
