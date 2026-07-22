import { useEffect, useState } from "react";

// One UI status bar: 24-hour clock + a couple of notification glyphs on the
// left; Wi-Fi, signal and a battery-percentage pill on the right. `dark` is
// set on the home screen (white chrome over the wallpaper); when an app is
// open the strip sits on a light surface and the glyphs flip to the app's
// text colour.
export default function AndroidStatusBar({ dark = false }: { dark?: boolean }) {
  const [clock, setClock] = useState(fmt());
  useEffect(() => {
    const t = setInterval(() => setClock(fmt()), 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={`and-statusbar ${dark ? "on-dark" : ""}`} aria-hidden="true">
      <span className="and-sb-left">
        <span className="and-sb-time">{clock}</span>
        {/* notification glyphs — a screen-record dot and a calendar */}
        <svg className="and-sb-notif" width="13" height="13" viewBox="0 0 20 20" fill="none">
          <rect x="2.5" y="4.5" width="15" height="11" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="10" cy="10" r="2.4" fill="currentColor" />
        </svg>
        <svg className="and-sb-notif" width="12" height="12" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="4" width="14" height="13" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3 8h14M7 2.5v3M13 2.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </span>

      <span className="and-sb-right">
        {/* mobile signal + data-activity arrows, One UI style */}
        <span className="and-sb-signal">
          <svg width="9" height="12" viewBox="0 0 9 12" fill="currentColor" className="and-sb-arrows">
            <path d="M2.4 5 4.4 2.4 6.4 5H4.9v1.4H3.9V5z" />
            <path d="M2.4 7h1.5V5.6h1V7h1.5L4.4 9.6z" opacity="0.75" />
          </svg>
          <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" className="and-sb-bars">
            <rect x="0" y="8.5" width="2.9" height="3.5" rx="0.7" />
            <rect x="4.9" y="6" width="2.9" height="6" rx="0.7" />
            <rect x="9.8" y="3.3" width="2.9" height="8.7" rx="0.7" />
            <rect x="14.7" y="0.6" width="2.9" height="11.4" rx="0.7" />
          </svg>
        </span>
        {/* battery percentage pill */}
        <span className="and-sb-batt">92</span>
      </span>
    </div>
  );
}

function fmt(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
