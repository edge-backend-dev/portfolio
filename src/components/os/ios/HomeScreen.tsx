import { useEffect, useState } from "react";
import { apps } from "../../../data/apps";
import { profile } from "../../../data/profile";
import { IOSAppIcon } from "../../apps/AppIcon";

interface Props {
  onOpen: (id: string, from: HTMLElement) => void;
  onSearch: () => void;
}

// Dock = first four primary apps; the rest live on the home grid.
const DOCK_IDS = ["about", "projects", "contact", "settings"];

export default function HomeScreen({ onOpen, onSearch }: Props) {
  const gridApps = apps.filter((a) => !DOCK_IDS.includes(a.id));
  const dockApps = DOCK_IDS.map((id) => apps.find((a) => a.id === id)!).filter(Boolean);

  return (
    <div className="ios-home">
      <div className="ios-widgets">
        <ProfileWidget />
        <CalendarWidget />
      </div>

      <div className="ios-grid">
        {gridApps.map((a) => (
          <button
            key={a.id}
            className="ios-app"
            data-app-icon={a.id}
            onClick={(e) => onOpen(a.id, e.currentTarget)}
          >
            <IOSAppIcon id={a.id} size={60} className="ios-app-icon" />
            <span className="ios-app-label">{a.title}</span>
          </button>
        ))}
      </div>

      {/* One page, so no dots — iOS 16 shows the Search pill in their place. */}
      <div className="ios-home-footer">
        <button className="ios-search-pill glass" type="button" aria-label="Search" onClick={onSearch}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.8" cy="6.8" r="5" stroke="currentColor" strokeWidth="2" />
            <path d="M10.6 10.6L14.5 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Search</span>
        </button>
      </div>

      <div className="ios-dock glass">
        {dockApps.map((a) => (
          <button
            key={a.id}
            className="ios-app dock"
            data-app-icon={a.id}
            onClick={(e) => onOpen(a.id, e.currentTarget)}
            aria-label={a.title}
          >
            <IOSAppIcon id={a.id} size={60} className="ios-app-icon" />
          </button>
        ))}
      </div>

      <div className="ios-home-bar" aria-hidden="true" />
    </div>
  );
}

/* A 2×2 widget in the Contacts/"person" idiom: monogram, name, role. Takes the
   left slot where iOS puts Weather. */
function ProfileWidget() {
  const initials = profile.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <div className="ios-widget ios-widget-profile">
      <div className="ios-widget-avatar" aria-hidden="true">
        {initials}
      </div>
      <div className="ios-widget-name">{profile.name}</div>
      <div className="ios-widget-role">{profile.role}</div>
    </div>
  );
}

/* The real iOS Calendar widget: red uppercase weekday over an outsized date,
   then the day's agenda. Reads the visitor's own clock, and re-checks on a slow
   timer so a tab left open overnight isn't showing yesterday. */
function CalendarWidget() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const weekday = now.toLocaleDateString([], { weekday: "long" }).toUpperCase();

  return (
    <div className="ios-widget ios-widget-calendar">
      <div className="ios-cal-weekday">{weekday}</div>
      <div className="ios-cal-date">{now.getDate()}</div>
      <div className="ios-cal-agenda">
        {profile.availability.open ? "Open to new projects" : "No events today"}
      </div>
    </div>
  );
}
