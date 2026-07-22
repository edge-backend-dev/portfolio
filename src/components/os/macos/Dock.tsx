import { apps } from "../../../data/apps";
import type { WinState } from "../../../shell/types";
import { AppIcon } from "../../apps/AppIcon";

interface Props {
  windows: WinState[];
  onLaunch: (id: string) => void;
  onMissionControl: () => void;
}

// The Tahoe dock: a translucent rounded slab of app tiles that magnify on
// hover and show a name bubble, a hairline divider, then the Trash. Each tile
// carries a `data-dock-id` so the genie animation knows where to fly a window.
// A small indicator dot sits under any app with an open window (minimized
// still counts as open) — the macOS running-app marker.
export default function Dock({ windows, onLaunch, onMissionControl }: Props) {
  const running = new Set(windows.map((w) => w.id));
  return (
    <div className="mac-dock-wrap">
      <nav className="mac-dock glass glass--refract" aria-label="Dock">
        {/* Finder — always the first, permanent Dock app on macOS. */}
        <button
          className="mac-dock-item"
          data-dock-id="finder"
          aria-label="Finder"
          onClick={() => onLaunch("finder")}
        >
          <span className="mac-dock-tip" aria-hidden="true">
            Finder
          </span>
          <AppIcon id="finder" size={48} depth className="mac-dock-icon" />
          {running.has("finder") && <span className="mac-dock-dot" aria-hidden="true" />}
        </button>

        {apps.map((a) => (
          <button
            key={a.id}
            className="mac-dock-item"
            data-dock-id={a.id}
            aria-label={a.title}
            onClick={() => onLaunch(a.id)}
          >
            <span className="mac-dock-tip" aria-hidden="true">
              {a.title}
            </span>
            <AppIcon id={a.id} size={48} radius={0.2237} depth className="mac-dock-icon" />
            {running.has(a.id) && <span className="mac-dock-dot" aria-hidden="true" />}
          </button>
        ))}

        <span className="mac-dock-sep" aria-hidden="true" />

        {/* Big Sur's default dock has no Mission Control tile — this one earns
            its place as the visible way in, since a trackpad swipe teaches
            nobody it exists. The bubble names the shortcut too. */}
        <button className="mac-dock-item" aria-label="Mission Control" onClick={onMissionControl}>
          <span className="mac-dock-tip" aria-hidden="true">
            Mission Control (⌃↑)
          </span>
          <AppIcon id="mission-control" size={48} depth className="mac-dock-icon" />
        </button>

        <button className="mac-dock-item mac-dock-trash" aria-label="Trash">
          <span className="mac-dock-tip" aria-hidden="true">
            Trash
          </span>
          <AppIcon id="trash" size={48} depth className="mac-dock-icon" />
        </button>
      </nav>
    </div>
  );
}
