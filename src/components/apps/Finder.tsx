import { apps } from "../../data/apps";
import { AppIcon } from "./AppIcon";
import type { AppApi } from "./appApi";

// The Finder window — macOS's file browser, reimagined as the portfolio's home
// base. A Favourites sidebar and an "Applications" grid, both listing the same
// apps the rest of the OS exposes; clicking any of them opens that app's window
// through the shared window manager. No real files here — it surfaces what the
// portfolio already has, so it earns the Dock's permanent first icon.
export default function Finder({ api }: { api: AppApi }) {
  return (
    <div className="finder-app">
      <aside className="finder-sidebar">
        <p className="finder-sb-label">Favourites</p>
        {apps.map((a) => (
          <button
            key={a.id}
            className="finder-sb-item"
            onClick={() => api.openApp(a.id)}
          >
            <AppIcon id={a.id} size={16} className="finder-sb-icon" />
            <span>{a.title}</span>
          </button>
        ))}
      </aside>

      <section className="finder-main">
        <header className="finder-crumb">Applications</header>
        <div className="finder-grid">
          {apps.map((a) => (
            <button
              key={a.id}
              className="finder-file"
              onClick={() => api.openApp(a.id)}
              title={`Open ${a.title}`}
            >
              <AppIcon id={a.id} size={54} className="finder-file-icon" />
              <span className="finder-file-name">{a.title}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
