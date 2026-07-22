import { getApp } from "../../../data/apps";
import type { WinState } from "../../../shell/types";
import type { AppApi } from "../../apps/appApi";
import { AppContent } from "../../apps/AppRouter";
import { AppIcon } from "../../apps/AppIcon";

interface Props {
  open: boolean;
  windows: WinState[];
  api: AppApi;
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
  onDismiss: () => void;
}

// Mission Control: every window scaled down onto one screen, live rather than
// snapshotted (the app stays mounted while minimized, so its real page renders
// straight into the thumbnail).
//
// Real Mission Control leaves minimized windows out entirely — they only exist
// in the dock. Here they get their own labelled row, dimmed: surfacing them is
// the whole reason this overlay exists.
export default function MissionControl({ open, windows, api, onOpen, onClose, onDismiss }: Props) {
  if (!open) return null;

  // back-to-front, so the tiling order matches the stack the user just left
  const live = windows.filter((w) => !w.minimized).sort((a, b) => a.z - b.z);
  const hidden = windows.filter((w) => w.minimized);

  const card = (w: WinState) => {
    const meta = getApp(w.id);
    if (!meta) return null;
    return (
      <div key={w.id} className="mc-card" data-minimized={w.minimized || undefined}>
        <button className="mc-thumb" aria-label={`Open ${meta.title}`} onClick={() => onOpen(w.id)}>
          <div className="mc-thumb-frame" aria-hidden="true">
            <AppContent id={w.id} api={api} />
          </div>
        </button>
        <button
          className="mc-quit"
          aria-label={`Close ${meta.title}`}
          onClick={(e) => {
            e.stopPropagation(); // closing a window isn't leaving the overlay
            onClose(w.id);
          }}
        >
          <svg width="9" height="9" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <line x1="1.6" y1="1.6" x2="8.4" y2="8.4" />
            <line x1="8.4" y1="1.6" x2="1.6" y2="8.4" />
          </svg>
        </button>
        <span className="mc-label">
          <AppIcon id={w.id} size={15} radius={0.2237} />
          {meta.title}
        </span>
      </div>
    );
  };

  // Clicking anywhere that isn't a window dismisses, as it does on macOS.
  return (
    <div className="mc-overlay" role="dialog" aria-label="Mission Control" onClick={onDismiss}>
      <div className="mc-stage">
        {windows.length === 0 ? (
          <p className="mc-empty">No open windows</p>
        ) : (
          <>
            {live.length > 0 && <div className="mc-grid">{live.map(card)}</div>}
            {hidden.length > 0 && (
              <>
                <p className="mc-divider">Minimized</p>
                <div className="mc-grid">{hidden.map(card)}</div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
