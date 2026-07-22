import { useEffect, useMemo, useRef, useState } from "react";
import { apps } from "../../../data/apps";
import { search, groupHits } from "../../../shell/search";
import { IOSAppIcon } from "../../apps/AppIcon";

interface Props {
  open: boolean;
  /** `from` is the tapped row/tile — the app zooms out of it, as iOS does */
  onLaunch: (id: string, from: HTMLElement) => void;
  onClose: () => void;
}

// iOS Spotlight. Same shared index as macOS Spotlight and the Windows Start
// menu (shell/search), so it searches portfolio *content* — a skill, a service,
// a résumé role — not just app names. The shape is what differs from the Mac:
// field pinned to the top with a Cancel button, results as inset-grouped cards,
// and Siri Suggestions while the field is empty.
//
// Escape is deliberately NOT handled here — IOSShell already owns a window-level
// Escape listener, and two handlers for one key is how you get a race.
export default function Spotlight({ open, onLaunch, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => search(query, 10), [query]);
  const groups = useMemo(() => groupHits(hits), [hits]);
  const q = query.trim();

  // Reset per opening, and take the caret. On hardware iOS raises the keyboard
  // with the field; focusing the input is the browser equivalent.
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
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  function choose(appId: string, from: HTMLElement) {
    onLaunch(appId, from);
    onClose();
  }

  // Arrow/Enter drive is for the desktop visitors who reach this skin; a real
  // phone just taps. Harmless either way.
  function onKeyDown(e: React.KeyboardEvent) {
    if (!hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[cursor];
      const row = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
      if (hit && row) choose(hit.appId, row);
    }
  }

  // Rendering is grouped but the cursor runs over the flat ranked list, so this
  // walks a counter across groups to recover each row's flat position.
  let flat = -1;

  return (
    <div className="ios-spotlight" role="dialog" aria-label="Search" aria-modal="true">
      {/* Tapping the blurred home screen behind the results dismisses, as on iOS */}
      <div className="ios-spot-scrim" onClick={onClose} aria-hidden="true" />

      <div className="ios-spot-bar">
        <div className="ios-spot-field glass">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.8" cy="6.8" r="5" stroke="currentColor" strokeWidth="2" />
            <path d="M10.6 10.6L14.5 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search"
            aria-label="Search"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls="ios-spot-results"
            aria-activedescendant={hits[cursor] ? `ios-spot-${hits[cursor].key}` : undefined}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <button className="ios-spot-cancel" onClick={onClose} type="button">
          Cancel
        </button>
      </div>

      <div className="ios-spot-results" id="ios-spot-results" ref={listRef} role="listbox">
        {!q ? (
          /* Empty field: iOS fills Spotlight with Siri Suggestions — an icon
             grid, not a list. */
          <div className="ios-spot-section">
            <div className="ios-spot-label">Siri Suggestions</div>
            <div className="ios-spot-suggest">
              {apps.map((a) => (
                <button
                  key={a.id}
                  className="ios-spot-sugg"
                  onClick={(e) => choose(a.id, e.currentTarget)}
                  type="button"
                >
                  <IOSAppIcon id={a.id} size={54} className="ios-spot-sugg-icon" />
                  <span className="ios-app-label">{a.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : hits.length > 0 ? (
          groups.map((g) => (
            <div key={g.group} className="ios-spot-section">
              <div className="ios-spot-label">{g.group}</div>
              <div className="ios-spot-card glass">
                {g.hits.map((h) => {
                  // capture per row: `flat` keeps mutating, so a handler that
                  // closed over the variable would read the final value
                  const i = ++flat;
                  const selected = i === cursor;
                  return (
                    <button
                      key={h.key}
                      id={`ios-spot-${h.key}`}
                      role="option"
                      aria-selected={selected}
                      data-selected={selected}
                      className="ios-spot-row"
                      onClick={(e) => choose(h.appId, e.currentTarget)}
                      type="button"
                    >
                      <IOSAppIcon id={h.appId} size={38} className="ios-spot-row-icon" />
                      <span className="ios-spot-text">
                        <span className="ios-spot-title">{h.title}</span>
                        <span className="ios-spot-sub">{h.subtitle}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="ios-spot-empty">
            <div className="ios-spot-empty-title">No Results</div>
            <div className="ios-spot-empty-sub">No results found for “{q}”.</div>
          </div>
        )}
      </div>
    </div>
  );
}
