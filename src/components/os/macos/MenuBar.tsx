import { useEffect, useState } from "react";
import { profile } from "../../../data/profile";

interface Props {
  activeTitle: string;
  onSpotlight: () => void;
}

// The Big Sur menu bar: Apple mark + a bold app name + the standard menus on the
// left, and the status cluster (battery, Wi-Fi, Spotlight, Control Center, Siri)
// with the day-and-time clock on the right.
const MENUS = ["File", "Edit", "View", "Go", "Window", "Help"];

export default function MenuBar({ activeTitle, onSpotlight }: Props) {
  const [clock, setClock] = useState(fmt());
  useEffect(() => {
    const t = setInterval(() => setClock(fmt()), 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mac-menubar" role="menubar" aria-label="Menu bar">
      <div className="mac-menu-left">
        <span className="mac-apple" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 12.9c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.15-.47 7.8 1.3 10.36.86 1.25 1.89 2.66 3.24 2.6 1.3-.05 1.79-.84 3.36-.84s2.01.84 3.39.81c1.4-.02 2.28-1.27 3.14-2.53a10.4 10.4 0 0 0 1.42-2.92c-.03-.01-2.72-1.04-2.75-4.13zM14.6 5.3c.72-.87 1.2-2.08 1.07-3.3-1.03.04-2.29.69-3.03 1.56-.66.77-1.24 2-1.09 3.18 1.15.09 2.33-.58 3.05-1.44z" />
          </svg>
        </span>
        <span className="mac-menu-app">{activeTitle || profile.name}</span>
        {MENUS.map((m) => (
          <span key={m} className="mac-menu-item">
            {m}
          </span>
        ))}
      </div>

      <div className="mac-menu-right">
        {/* battery */}
        <span className="mac-status" aria-hidden="true">
          <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
            <rect x="1" y="1.5" width="21" height="10" rx="3" stroke="currentColor" strokeWidth="1.1" opacity="0.55" />
            <rect x="2.6" y="3" width="16" height="7" rx="1.6" fill="currentColor" />
            <rect x="23.3" y="4.6" width="1.6" height="3.8" rx="0.8" fill="currentColor" opacity="0.55" />
          </svg>
        </span>
        {/* Wi-Fi */}
        <span className="mac-status" aria-hidden="true">
          <svg width="17" height="13" viewBox="0 0 20 14" fill="currentColor">
            <path d="M10 3.2c2.6 0 4.98 1 6.76 2.64l1.4-1.5A11.9 11.9 0 0 0 10 1.2 11.9 11.9 0 0 0 1.84 4.34l1.4 1.5A9.9 9.9 0 0 1 10 3.2zm0 3.9c1.5 0 2.86.58 3.88 1.53l1.4-1.5A8 8 0 0 0 10 5.1a8 8 0 0 0-5.28 2.02l1.4 1.5A5.7 5.7 0 0 1 10 7.1zm0 3.9c.83 0 1.57.34 2.11.88L10 12.8l-2.11-1.02c.54-.54 1.28-.88 2.11-.88z" />
          </svg>
        </span>
        {/* Spotlight */}
        <button className="mac-status mac-status-btn" aria-label="Spotlight Search" title="Spotlight (⌘K)" onClick={onSpotlight}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="6" stroke="currentColor" strokeWidth="1.6" />
            <line x1="13" y1="13" x2="18" y2="18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        {/* Control Center */}
        <span className="mac-status" aria-label="Control Center" role="img">
          <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
            <rect x="3" y="3" width="16" height="16" rx="6" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
            <rect x="6.2" y="5.6" width="4.2" height="4.2" rx="2.1" fill="currentColor" />
            <rect x="11.6" y="12.2" width="4.2" height="4.2" rx="2.1" fill="currentColor" />
            <line x1="8.3" y1="10.6" x2="8.3" y2="16.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="13.7" y1="5.6" x2="13.7" y2="11.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </span>
        {/* Siri */}
        <span className="mac-status mac-siri" aria-label="Siri" role="img">
          <svg width="16" height="16" viewBox="0 0 22 22">
            <defs>
              <linearGradient id="siri-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ff5e7e" />
                <stop offset="0.5" stopColor="#a24bff" />
                <stop offset="1" stopColor="#3ac6ff" />
              </linearGradient>
            </defs>
            <circle cx="11" cy="11" r="9.5" fill="url(#siri-g)" />
            <circle cx="11" cy="11" r="4.4" fill="#fff" opacity="0.92" />
          </svg>
        </span>
        <span className="mac-clock">{clock}</span>
      </div>
    </div>
  );
}

function fmt(): string {
  const now = new Date();
  const day = now.toLocaleDateString([], { weekday: "short" });
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${day} ${time}`;
}
