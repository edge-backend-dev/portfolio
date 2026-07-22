import { useEffect, useMemo, useRef, useState } from "react";
import { search, groupHits } from "../../../shell/search";
import { AppIcon } from "../../apps/AppIcon";

interface Props {
  open: boolean;
  onLaunch: (id: string) => void;
  onClose: () => void;
}

// macOS Spotlight: a centred vibrancy panel with one big field, grouped results
// and full keyboard drive. Results come from the shared index in shell/search,
// so this searches portfolio content — not just app names.
export default function Spotlight({ open, onLaunch, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => search(query), [query]);
  const groups = useMemo(() => groupHits(hits), [hits]);

  // Reset per opening, and take focus once the panel is actually mounted.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    inputRef.current?.focus();
  }, [open]);

  // A new query re-ranks everything, so the old cursor position is meaningless.
  useEffect(() => setCursor(0), [query]);

  // Keep the highlighted row in view when arrowing past the visible window.
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  function choose(appId: string) {
    onLaunch(appId);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (hits.length ? (c + 1) % hits.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (hits.length ? (c - 1 + hits.length) % hits.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[cursor];
      if (hit) choose(hit.appId);
    }
  }

  // Rendering is grouped but the cursor runs over the flat ranked list, so this
  // walks a counter across groups to recover each row's flat position.
  let flat = -1;

  return (
    <>
      <div className="mac-spot-scrim" onClick={onClose} aria-hidden="true" />
      <div className="mac-spotlight glass glass--refract" role="dialog" aria-label="Spotlight Search">
        <div className="mac-spot-field">
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="6" stroke="currentColor" strokeWidth="1.6" />
            <line x1="13" y1="13" x2="18" y2="18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Spotlight Search"
            aria-label="Spotlight Search"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls="mac-spot-results"
            aria-activedescendant={hits[cursor] ? `spot-${hits[cursor].key}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>

        {query.trim() &&
          (hits.length > 0 ? (
            <div className="mac-spot-results" id="mac-spot-results" role="listbox" ref={listRef}>
              {groups.map((g) => (
                <div key={g.group} className="mac-spot-group">
                  <div className="mac-spot-group-label">{g.group}</div>
                  {g.hits.map((h) => {
                    // capture per row: `flat` keeps mutating, so a handler that
                    // closed over the variable would read the final value
                    const i = ++flat;
                    const selected = i === cursor;
                    return (
                      <button
                        key={h.key}
                        id={`spot-${h.key}`}
                        role="option"
                        aria-selected={selected}
                        data-selected={selected}
                        className="mac-spot-row"
                        onClick={() => choose(h.appId)}
                        // mousemove, not mouseenter: a row sliding under a still
                        // pointer during arrow-key nav shouldn't steal selection
                        onMouseMove={() => setCursor(i)}
                      >
                        <AppIcon id={h.appId} size={26} radius={0.2237} />
                        <span className="mac-spot-text">
                          <span className="mac-spot-title">{h.title}</span>
                          <span className="mac-spot-sub">{h.subtitle}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="mac-spot-empty">No results for “{query.trim()}”</div>
          ))}
      </div>
    </>
  );
}
