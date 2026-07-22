import { useEffect, useState } from "react";

// Real iOS splits the status bar around the notch: time hard left, then the
// signal / Wi-Fi / battery cluster hard right. The glyphs are sized off the
// real ones — 17×11 bars, 17×12 Wi-Fi, 27×13 battery.
export default function IOSStatusBar({ dark = false }: { dark?: boolean }) {
  const [clock, setClock] = useState(fmt());
  useEffect(() => {
    const t = setInterval(() => setClock(fmt()), 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={`ios-statusbar ${dark ? "on-dark" : ""}`} aria-hidden="true">
      <span className="ios-sb-time">{clock}</span>

      <span className="ios-sb-notch" />

      <span className="ios-sb-right">
        {/* cellular — four bars, tallest last, none dimmed (full signal) */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
          <rect x="0" y="7.5" width="3" height="3.5" rx="1" />
          <rect x="4.7" y="5" width="3" height="6" rx="1" />
          <rect x="9.4" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="14.1" y="0" width="3" height="11" rx="1" />
        </svg>

        {/* wi-fi — three arcs sharing one origin */}
        <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
          <path d="M8.5 2.35c2.72 0 5.2 1.05 7.06 2.77l1.2-1.3A11.9 11.9 0 0 0 8.5.1 11.9 11.9 0 0 0 .24 3.82l1.2 1.3A10.2 10.2 0 0 1 8.5 2.35z" />
          <path d="M8.5 5.9c1.6 0 3.05.62 4.14 1.63l1.2-1.3A8.2 8.2 0 0 0 8.5 3.9a8.2 8.2 0 0 0-5.34 2.33l1.2 1.3A6.1 6.1 0 0 1 8.5 5.9z" />
          <path d="M8.5 9.1c.72 0 1.37.3 1.84.77L8.5 11.9 6.66 9.87c.47-.48 1.12-.77 1.84-.77z" />
        </svg>

        {/* battery — outline + fill + terminal nub, ~80% charged */}
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
          <rect x="0.5" y="0.5" width="22" height="12" rx="3.8" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <rect x="2" y="2" width="16.8" height="9" rx="2.5" fill="currentColor" />
          <path
            d="M24.5 4.4c1 .35 1.6 1.1 1.6 2.1s-.6 1.75-1.6 2.1z"
            fill="currentColor"
            opacity="0.4"
          />
        </svg>
      </span>
    </div>
  );
}

// The iOS status bar shows "5:07", never "5:07 PM" — but it still respects the
// locale's 12/24h convention. So format for the locale, then drop the dayPeriod
// part. Doing this via formatToParts rather than a /[AP]M/ regex keeps it
// correct for locales that write the period in non-Latin script, or lead with
// it (ja-JP renders "午後5:07").
function fmt(): string {
  return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" })
    .formatToParts(new Date())
    .filter((p) => p.type !== "dayPeriod")
    .map((p) => p.value)
    .join("")
    .trim();
}
