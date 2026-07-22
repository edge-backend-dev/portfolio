import { useMemo, useRef, useState } from "react";
import { apps, getApp } from "../../../data/apps";
import { profile } from "../../../data/profile";
import { search, groupHits, type SearchHit } from "../../../shell/search";
import { AppIcon } from "../../apps/AppIcon";

interface Props {
  open: boolean;
  onLaunch: (id: string) => void;
  onClose: () => void;
}

// "Recommended" strip — Win11 shows recent files/apps here; we surface the
// portfolio content a visitor most likely wants next.
const RECOMMENDED: { id: string; note: string }[] = [
  { id: "resume", note: "Recently added" },
  { id: "projects", note: "Recently updated" },
  { id: "contact", note: "Get in touch" },
  { id: "terminal", note: "Try the interactive CLI" },
  { id: "services", note: "What I build" },
  { id: "skills", note: "Tools I work with" },
];
const RECO_COLLAPSED = 4; // two rows, as Win11 shows before "Show all"

// The "All" section's Category view. Win11 buckets apps into themed cards, each
// previewing up to four of its icons; ours group the portfolio by what the
// visitor is trying to find out.
const CATEGORIES: { name: string; ids: string[] }[] = [
  { name: "Profile", ids: ["about", "resume", "skills"] },
  { name: "Work", ids: ["projects", "services"] },
  { name: "Connect", ids: ["contact"] },
  { name: "System", ids: ["terminal", "settings"] },
];

type AllView = "category" | "grid" | "list";
const VIEW_LABEL: Record<AllView, string> = {
  category: "Category",
  grid: "Grid",
  list: "List",
};

// Windows 11 Start menu: search on top, then one scrolling surface holding
// Pinned, Recommended and All (with its Category / Grid / List view switch),
// over a footer strip with the user and power button.
export default function StartMenu({ open, onLaunch, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [recoAll, setRecoAll] = useState(false);
  const [allView, setAllView] = useState<AllView>("category");
  const [viewMenu, setViewMenu] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);

  const allRef = useRef<HTMLDivElement>(null);

  // Searches the shared content index (apps, projects, skills, services,
  // resume, contact) — not just app titles.
  const hits = useMemo(() => search(query, 9), [query]);
  const searching = query.trim().length > 0;

  if (!open) return null;

  function launch(id: string) {
    onLaunch(id);
    setQuery("");
    setCursor(0);
    setRecoAll(false);
    setViewMenu(false);
    setOpenCat(null);
    onClose();
  }

  function onSearchKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (hits.length ? (c + 1) % hits.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (hits.length ? (c - 1 + hits.length) % hits.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[cursor];
      if (hit) launch(hit.appId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  // Win11 search: the top hit gets a prominent "Best match" row, everything
  // else is listed under its group. The keyboard cursor runs over the flat
  // ranked list, so rows carry their flat position rather than a per-group one.
  function renderHits() {
    const row = (h: SearchHit, i: number) => (
      <button
        key={h.key}
        role="option"
        aria-selected={i === cursor}
        data-selected={i === cursor}
        className="start-hit"
        onClick={() => launch(h.appId)}
        onMouseMove={() => setCursor(i)}
      >
        <AppIcon id={h.appId} size={i === 0 ? 32 : 24} radius={0.18} />
        <span className="start-hit-text">
          <span className="start-hit-title">{h.title}</span>
          <span className="start-hit-sub">{h.subtitle}</span>
        </span>
      </button>
    );

    let flat = 0;
    return (
      <div role="listbox" aria-label="Search results">
        <div className="start-row">
          <span className="start-section">Best match</span>
        </div>
        <div className="start-list start-list-best">{row(hits[0], 0)}</div>
        {groupHits(hits.slice(1)).map((g) => (
          <div key={g.group}>
            <div className="start-row start-row-group">
              <span className="start-section">{g.group}</span>
            </div>
            <div className="start-list">{g.hits.map((h) => row(h, ++flat))}</div>
          </div>
        ))}
      </div>
    );
  }

  const appTile = (a: (typeof apps)[number]) => (
    <button key={a.id} className="start-app" role="menuitem" onClick={() => launch(a.id)}>
      <AppIcon id={a.id} size={34} radius={0.18} className="start-app-icon" />
      <span className="start-app-label">{a.title}</span>
    </button>
  );

  // The three "All" views: themed cards, an A–Z icon grid, or an A–Z list.
  const alphabetical = [...apps].sort((a, b) => a.title.localeCompare(b.title));

  function renderAll() {
    if (allView === "grid") return <div className="start-grid">{alphabetical.map(appTile)}</div>;

    if (allView === "list") {
      return (
        <div className="start-list">
          {alphabetical.map((a) => (
            <button key={a.id} className="start-list-item" onClick={() => launch(a.id)}>
              <AppIcon id={a.id} size={26} radius={0.18} />
              <span>{a.title}</span>
            </button>
          ))}
        </div>
      );
    }

    // Category view. Opening a card replaces the card grid with that category's
    // apps, the way Win11 expands a category in place.
    const cat = CATEGORIES.find((c) => c.name === openCat);
    if (cat) {
      return (
        <>
          <div className="start-row">
            <button className="start-pill" onClick={() => setOpenCat(null)}>
              <Chevron dir="left" />
              Back
            </button>
          </div>
          <div className="start-grid">
            {cat.ids.map((id) => getApp(id)).filter((a) => !!a).map((a) => appTile(a!))}
          </div>
        </>
      );
    }

    return (
      <div className="start-cats">
        {CATEGORIES.map((c) => (
          <button key={c.name} className="start-cat" onClick={() => setOpenCat(c.name)}>
            <span className="start-cat-tiles" aria-hidden="true">
              {c.ids.slice(0, 4).map((id) => (
                <AppIcon key={id} id={id} size={28} radius={0.18} />
              ))}
            </span>
            <span className="start-cat-name">{c.name}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="start-scrim" onClick={onClose} aria-hidden="true" />
      <div className="start-menu" role="dialog" aria-label="Start menu">
        <div className="start-search">
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="start-search-glyph" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3ac9a3" />
                <stop offset="1" stopColor="#1c8ed8" />
              </linearGradient>
            </defs>
            <g stroke="url(#start-search-glyph)" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="8" cy="8" r="5.2" />
              <path d="m12.1 12.1 3.5 3.5" />
            </g>
          </svg>
          <input
            type="text"
            placeholder="Search for apps, settings, and documents"
            aria-label="Search"
            value={query}
            autoFocus
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0); // a re-ranked list makes the old position meaningless
            }}
            onKeyDown={onSearchKey}
          />
        </div>

        <div className="start-body">
          {searching ? (
            hits.length > 0 ? (
              <div className="start-results">{renderHits()}</div>
            ) : (
              <div className="start-empty">No results for “{query.trim()}”</div>
            )
          ) : (
            <>
              <div className="start-row">
                <span className="start-section">Pinned</span>
                {/* Every pin already fits the two rows Win11 shows by default,
                    so "Show all" does the thing it promises: jumps to All. */}
                <button
                  className="start-pill"
                  onClick={() => allRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  Show all
                  <Chevron dir="down" />
                </button>
              </div>
              <div className="start-grid">{apps.map(appTile)}</div>

              <div className="start-row start-row-reco">
                <span className="start-section">Recommended</span>
                <button className="start-pill" aria-expanded={recoAll} onClick={() => setRecoAll((v) => !v)}>
                  {recoAll ? "Show less" : "Show all"}
                  <Chevron dir="right" className="start-pill-chev" />
                </button>
              </div>
              <div className="start-reco">
                {(recoAll ? RECOMMENDED : RECOMMENDED.slice(0, RECO_COLLAPSED)).map((r) => {
                  const a = getApp(r.id);
                  if (!a) return null;
                  return (
                    <button key={r.id} className="start-reco-item" onClick={() => launch(r.id)}>
                      <AppIcon id={r.id} size={30} radius={0.18} />
                      <span className="start-reco-text">
                        <span className="start-reco-title">{a.title}</span>
                        <span className="start-reco-note">{r.note}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="start-row start-row-all" ref={allRef}>
                <span className="start-section">All</span>
                <div className="start-view">
                  <button
                    className="start-pill"
                    aria-haspopup="menu"
                    aria-expanded={viewMenu}
                    onClick={() => setViewMenu((v) => !v)}
                  >
                    View: {VIEW_LABEL[allView]}
                    <Chevron dir="down" />
                  </button>
                  {viewMenu && (
                    <>
                      <div className="start-view-scrim" onClick={() => setViewMenu(false)} aria-hidden="true" />
                      <div className="start-view-menu" role="menu">
                        {(Object.keys(VIEW_LABEL) as AllView[]).map((v) => (
                          <button
                            key={v}
                            className="start-view-item"
                            role="menuitemradio"
                            aria-checked={allView === v}
                            onClick={() => {
                              setAllView(v);
                              setOpenCat(null);
                              setViewMenu(false);
                            }}
                          >
                            {VIEW_LABEL[v]}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {renderAll()}
            </>
          )}
        </div>

        <div className="start-footer">
          <button className="start-user" onClick={() => launch("about")} title="About me">
            <span className="start-avatar" aria-hidden="true">
              {profile.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
            <span>{profile.name}</span>
          </button>
        </div>
      </div>
    </>
  );
}

function Chevron({ dir, className }: { dir: "down" | "right" | "left"; className?: string }) {
  const d = dir === "down" ? "M1.5 3.5 5 7l3.5-3.5" : dir === "right" ? "M3.5 1.5 7 5 3.5 8.5" : "M6.5 1.5 3 5l3.5 3.5";
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
