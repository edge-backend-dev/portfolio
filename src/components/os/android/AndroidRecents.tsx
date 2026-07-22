import { useLayoutEffect, useRef } from "react";
import { getApp } from "../../../data/apps";
import type { AppApi } from "../../apps/appApi";
import { AppContent } from "../../apps/AppRouter";
import { AppIcon } from "../../apps/AppIcon";

interface Props {
  recents: string[];
  splitPick: string | null;
  api: AppApi;
  onOpen: (id: string, from: HTMLElement) => void;
  onStartSplit: (id: string) => void;
  onPickBottom: (id: string) => void;
  onCloseAll: () => void;
}

// A handful of quick launches pinned at the bottom of the overview, mirroring
// One UI's suggested-apps row under the recents carousel.
const SUGGEST = ["about", "projects", "skills", "contact"];

// One UI Recents: a carousel of cards, one per app opened this session, each
// showing a live scaled preview under a centred app-icon badge (One UI 8.5
// floats the icon on the card's top edge). Tap a card to reopen it; tap its
// icon badge to start a split-screen pairing.
export default function AndroidRecents({
  recents,
  splitPick,
  api,
  onOpen,
  onStartSplit,
  onPickBottom,
  onCloseAll,
}: Props) {
  const suggest = SUGGEST.map((id) => getApp(id)).filter((m): m is NonNullable<typeof m> => !!m);

  // One UI stacks recents oldest → newest left-to-right and opens focused on the
  // most-recent card at the right edge. `recents` is stored newest-first, so we
  // render it reversed and scroll the track fully right whenever it changes.
  const trackRef = useRef<HTMLDivElement>(null);
  const ordered = [...recents].reverse();
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [recents.length]);

  return (
    <div className="and-recents">
      {splitPick && <div className="and-recents-hint">Tap another app to use in split screen view</div>}

      {recents.length === 0 ? (
        <div className="and-recents-empty">No recent apps</div>
      ) : (
        <div className="and-recents-track" ref={trackRef}>
          {ordered.map((id) => {
            const meta = getApp(id);
            if (!meta) return null;
            const isTop = splitPick === id;
            return (
              <div key={id} className={`and-recent-card${isTop ? " is-top" : ""}`}>
                {/* Floating icon badge — One UI centres it on the card's top
                    edge; tapping it starts a split-screen pairing. */}
                <button
                  className="and-recent-badge-btn"
                  onClick={() => !splitPick && onStartSplit(id)}
                  disabled={!!splitPick}
                  aria-label={splitPick ? meta.title : `${meta.title} — open in split screen view`}
                  title={splitPick ? undefined : "Open in split screen view"}
                >
                  <AppIcon id={id} size={30} round />
                </button>

                <div className="and-recent-preview">
                  {/* Live app rendered at full width, scaled down like a real
                      recent-app thumbnail; inert so it can't take focus/clicks. */}
                  <div className="and-recent-scale" inert>
                    <h2 className="and-recent-scale-title">
                      <AppIcon id={id} size={26} round />
                      {meta.title}
                    </h2>
                    <AppContent id={id} api={api} />
                  </div>
                  {isTop && <span className="and-recent-badge">Top</span>}
                  {/* Transparent hit layer — a real button (keyboard/AT reachable)
                      that's a SIBLING of the app content, never its ancestor, so
                      the app's own buttons don't end up nested inside a button. */}
                  <button
                    className="and-recent-hit"
                    onClick={(e) => (splitPick ? onPickBottom(id) : onOpen(id, e.currentTarget))}
                    aria-label={splitPick ? `Use ${meta.title} in split screen` : `Open ${meta.title}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {recents.length > 0 && (
        <button className="and-recents-closeall" onClick={onCloseAll}>
          Close all
        </button>
      )}

      {/* Suggested apps dock — always available, One UI style. */}
      <div className="and-recents-dock">
        {suggest.map((m) => (
          <button
            key={m.id}
            className="and-recents-dock-app"
            onClick={(e) => onOpen(m.id, e.currentTarget)}
            aria-label={m.title}
            title={m.title}
          >
            <AppIcon id={m.id} size={58} round />
          </button>
        ))}
      </div>
    </div>
  );
}
