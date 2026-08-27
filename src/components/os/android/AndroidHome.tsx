import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { apps } from "../../../data/apps";
import { profile } from "../../../data/profile";
import { AppIcon } from "../../apps/AppIcon";
import StartMark from "./StartMark";

interface Props {
  onOpen: (id: string, from: HTMLElement) => void;
  onSearch: () => void;
}

// Dock holds the four "primary destinations"; everything else lands in the
// single home-screen row, mirroring One UI's default launcher.
const DOCK_IDS = ["about", "projects", "contact", "settings"];

export default function AndroidHome({ onOpen, onSearch }: Props) {
  const now = useClock();
  const sky = skyPhase(now);
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
          {/* Photo widget in the Photos idiom, the same card the iOS home
              carries. It used to show availability over an invented progress
              bar; that reading belongs in About Me and Contact, where a
              visitor can act on it, not in a widget that cannot. */}
          <div className="and-status">
            {/* Decorative: the name it would announce is right below it. */}
            <img className="and-status-photo" src="/profile.jpg" alt="" />
            <div className="and-status-caption">
              <div className="and-status-name">{profile.name}</div>
              <div className="and-status-role">{profile.role}</div>
            </div>
          </div>

          <div className="and-widget-col">
            <div
              className="and-pill and-pill-greet"
              style={
                {
                  "--greet-dim": sky.dim,
                  "--greet-night": sky.night,
                } as CSSProperties
              }
            >
              <span className="and-greet-sky and-greet-day" aria-hidden="true" />
              <span className="and-greet-sky and-greet-dusk" aria-hidden="true" />
              <span className="and-greet-sky and-greet-night-sky" aria-hidden="true" />
              {/* The picture says what time it is; the words only covered it.
                  Kept for screen readers, which get nothing from the artwork. */}
              <span className="and-greet-sr">{greeting(now)}</span>
            </div>
            <button
              className="and-pill and-pill-start"
              onClick={(e) => onOpen("about", e.currentTarget)}
              aria-label="Start — open About Me"
            >
              {/* Live text, not the lettering baked into the source artwork,
                  so the word stays sharp at any zoom or pixel density. */}
              <span className="and-start-label">Start</span>
              <StartMark />
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
// There is deliberately no "Good night": that is a parting phrase, so it reads
// as "goodbye" to someone who just arrived. "Good evening" carries the whole
// stretch after sunset — the artwork behind the pill shows the hour instead.
function greeting(d: Date): string {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  return "Good evening";
}

// Fraction of the way from `a` to `b` that `t` sits, clamped to 0–1.
function ramp(t: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
}

// The two dials the greeting pill's artwork rides on, both continuous so the
// sky slides through sunset rather than snapping between three pictures:
//   dim   — how far the bright sun illustration is dimmed toward sunset
//   night — how far the moon illustration has faded in over it
// Decimal hours, so 18:30 is 18.5 and the move is minute-by-minute.
function skyPhase(d: Date): { dim: number; night: number } {
  const t = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  // Twilight: burns off after 05:30, returns from 16:30, and holds overnight.
  // Dawn needs it as much as dusk does — the moon has to dissolve against a
  // dark sky at both ends, or sunrise just looks like a washed-out noon.
  const dim = t < 5.5 ? 1 : t < 7 ? 1 - ramp(t, 5.5, 7) : ramp(t, 16.5, 20);
  // Moon rises from 19:45, holds all night, and is gone by 06:00.
  const night = t < 7 ? 1 - ramp(t, 4.8, 6) : ramp(t, 19.75, 21);
  return { dim, night };
}
