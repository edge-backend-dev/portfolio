import type { AppApi } from "./appApi";
import type { OSKind } from "../../shell/types";
import { wallpapers } from "../../data/wallpapers";

const OS_OPTIONS: { id: OSKind; label: string }[] = [
  { id: "windows", label: "Windows" },
  { id: "macos", label: "macOS" },
  { id: "ios", label: "iOS" },
  { id: "android", label: "Android" },
];

export default function Settings({ api }: { api: AppApi }) {
  const isDesktop = api.os === "windows" || api.os === "macos";
  return (
    <div className="app settings">
      <section className="setting-block">
        <h3 className="section-h">Appearance</h3>
        <div className="setting-row">
          <div>
            <div className="setting-label">Theme</div>
            <div className="setting-hint">Light or dark across every skin.</div>
          </div>
          <div className="segmented">
            <button
              className={api.theme === "light" ? "seg active" : "seg"}
              onClick={() => api.setTheme("light")}
            >
              Light
            </button>
            <button
              className={api.theme === "dark" ? "seg active" : "seg"}
              onClick={() => api.setTheme("dark")}
            >
              Dark
            </button>
          </div>
        </div>
      </section>

      {isDesktop && (
        <section className="setting-block">
          <h3 className="section-h">Wallpaper</h3>
          <p className="setting-hint">
            Pick a background, or leave it on Auto to cycle through them every 15 seconds
            with a smooth fade.
          </p>
          <div className="wp-grid">
            <button
              className={`wp-thumb wp-thumb-auto ${api.wallpaper === "auto" ? "active" : ""}`}
              onClick={() => api.setWallpaper("auto")}
              aria-pressed={api.wallpaper === "auto"}
            >
              <span className="wp-thumb-auto-icon" aria-hidden="true">
                ⟳
              </span>
              <span className="wp-thumb-label">Auto</span>
            </button>
            {wallpapers.map((w, i) => (
              <button
                key={w.id}
                className={`wp-thumb ${api.wallpaper === w.id ? "active" : ""}`}
                style={{ backgroundImage: `url("${w.src}")` }}
                onClick={() => api.setWallpaper(w.id)}
                aria-pressed={api.wallpaper === w.id}
                aria-label={`Wallpaper ${i + 1}`}
                title={w.label}
              />
            ))}
          </div>
        </section>
      )}

      <section className="setting-block">
        <h3 className="section-h">Operating system look</h3>
        <p className="setting-hint">
          This site auto-detects your device and dresses up like its OS. Detected:{" "}
          <strong>{osLabel(api.autoOS)}</strong>. You can override it below.
        </p>
        <div className="os-grid">
          {OS_OPTIONS.map((o) => (
            <button
              key={o.id}
              className={`os-option ${api.os === o.id ? "active" : ""}`}
              onClick={() => api.setOS(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {api.overriding && (
          <button className="btn-ghost sm" onClick={() => api.setOS(null)} style={{ marginTop: 10 }}>
            Reset to auto ({osLabel(api.autoOS)})
          </button>
        )}
      </section>

      <section className="setting-block">
        <h3 className="section-h">Windows</h3>
        <div className="setting-row">
          <div>
            <div className="setting-label">Reset window layout</div>
            <div className="setting-hint">Clear saved positions and sizes for every app.</div>
          </div>
          <button className="btn-ghost sm" onClick={api.resetLayout}>
            Reset layout
          </button>
        </div>
      </section>
    </div>
  );
}

function osLabel(os: OSKind): string {
  return { windows: "Windows", macos: "macOS", ios: "iOS", android: "Android" }[os];
}
