import { useEffect, useState } from "react";
import { apps } from "../../../data/apps";
import { profile } from "../../../data/profile";
import { AppIcon } from "../../apps/AppIcon";

interface Props {
  onOpen: (id: string, from: HTMLElement) => void;
  onSearch: () => void;
}

// Dock holds the four "primary destinations"; everything else lands in the
// single home-screen row, mirroring One UI's default launcher.
const DOCK_IDS = ["about", "projects", "contact", "settings"];

export default function AndroidHome({ onOpen, onSearch }: Props) {
  const now = useClock();
  const open = profile.availability.open;
  const gridApps = apps.filter((a) => !DOCK_IDS.includes(a.id));
  const dockApps = DOCK_IDS.map((id) => apps.find((a) => a.id === id)!).filter(Boolean);

  const date = now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return (
    <div className="and-home">
      <div className="and-top">
        {/* Live clock widget — One UI's signature date + seconds card */}
        <div className="and-clock-widget">
          <div className="and-clock-date">{date}</div>
          <div className="and-clock-time">
            {hh}:{mm}
            <span className="and-clock-sec">:{ss}</span>
          </div>
        </div>

        {/* Availability + greeting + Start — the One UI widget cluster, with the
            weather slot repurposed to a live portfolio status card. */}
        <div className="and-widget-row">
          <div className="and-status">
            <div className="and-status-top">
              <span className="and-status-head">{open ? "Open" : "Booked"}</span>
              <span className={`and-status-dot${open ? " is-open" : ""}`} aria-hidden="true" />
            </div>
            <div className="and-status-desc">
              {open ? "Available for select projects" : "Currently at capacity"}
            </div>
            <div className="and-status-graph" aria-hidden="true">
              <span className="and-status-bar" />
            </div>
            <div className="and-status-scale">
              <span>1 wk</span>
              <span>3 wks</span>
            </div>
            <div className="and-status-role">{profile.role}</div>
          </div>

          <div className="and-widget-col">
            <div className="and-pill and-pill-greet">{greeting(now)}</div>
            <button
              className="and-pill and-pill-start"
              onClick={(e) => onOpen("about", e.currentTarget)}
              aria-label="Start — open About Me"
            >
              <span>Start</span>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="and-pill-mark">
                <path
                  d="M12 20s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 15.65 12 20 12 20Z"
                  fill="url(#and-heart)"
                />
                <defs>
                  <linearGradient id="and-heart" x1="5" y1="6" x2="19" y2="20" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#33d17a" />
                    <stop offset="0.5" stopColor="#3584e4" />
                    <stop offset="1" stopColor="#e05fd0" />
                  </linearGradient>
                </defs>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="and-spacer" />

      {/* App row */}
      <div className="and-grid">
        {gridApps.map((a) => (
          <button
            key={a.id}
            className="and-app"
            data-app-icon={a.id}
            onClick={(e) => onOpen(a.id, e.currentTarget)}
          >
            <AppIcon id={a.id} size={58} round className="and-app-icon" />
            <span className="and-app-label">{a.title}</span>
          </button>
        ))}
      </div>

      <div className="and-dock">
        {dockApps.map((a) => (
          <button
            key={a.id}
            className="and-app dock"
            data-app-icon={a.id}
            onClick={(e) => onOpen(a.id, e.currentTarget)}
            aria-label={a.title}
          >
            <AppIcon id={a.id} size={58} round className="and-app-icon" />
            <span className="and-app-label">{a.title}</span>
          </button>
        ))}
      </div>

      {/* One UI Finder bar — the translucent search pill pinned at the very
          bottom of the launcher; opens the full-screen search. */}
      <button className="and-homesearch" onClick={onSearch} aria-label="Search">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="and-homesearch-ic">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.6-3.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="and-homesearch-label">Search</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="and-homesearch-mic">
          <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

// Ticks once a second so the clock widget shows live seconds like One UI's.
function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// Time-of-day greeting on the viewer's own clock: 2pm → "Good afternoon".
function greeting(d: Date): string {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 21) return "Good evening";
  return "Good night";
}
