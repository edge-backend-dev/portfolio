import { useEffect, useRef, useState } from "react";
import { apps } from "../../../data/apps";
import type { WinState } from "../../../shell/types";
import type { AppApi } from "../../apps/appApi";
import { AppContent } from "../../apps/AppRouter";
import { AppIcon } from "../../apps/AppIcon";

interface Props {
  windows: WinState[];
  onStart: () => void;
  startOpen: boolean;
  onLaunch: (id: string) => void;
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
  onSearch: () => void;
  onTaskView: () => void;
  onShowDesktop: () => void;
  focusedId: string | null;
  api: AppApi;
}

// Windows 11 taskbar: full-width bar, centred icon cluster (Start / Search /
// Task view / pinned apps) and a system tray with status icons + clock.
export default function Taskbar({
  windows,
  onStart,
  startOpen,
  onLaunch,
  onOpen,
  onClose,
  onSearch,
  onTaskView,
  onShowDesktop,
  focusedId,
  api,
}: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Hover thumbnail previews, Win11-style: hovering a running app raises a live,
  // scaled render of its page above the button. Open/close on short delays so the
  // pointer can travel from the button into the preview without it vanishing.
  const [preview, setPreview] = useState<string | null>(null);
  const hoverTimers = useRef<{ open?: number; close?: number }>({});
  useEffect(() => {
    const t = hoverTimers.current;
    return () => {
      window.clearTimeout(t.open);
      window.clearTimeout(t.close);
    };
  }, []);
  function openPreview(id: string) {
    window.clearTimeout(hoverTimers.current.close);
    hoverTimers.current.open = window.setTimeout(() => setPreview(id), 240);
  }
  function scheduleClose() {
    window.clearTimeout(hoverTimers.current.open);
    hoverTimers.current.close = window.setTimeout(() => setPreview(null), 160);
  }
  function cancelClose() {
    window.clearTimeout(hoverTimers.current.close);
  }

  const pinned = apps; // primary apps + Settings, Win11-style pinned row

  return (
    <nav className="win-taskbar" aria-label="Taskbar">
      <div className="win-tb-center">
        <button
          className={`win-tb-btn win-start ${startOpen ? "active-btn" : ""}`}
          aria-label="Start"
          aria-expanded={startOpen}
          title="Start"
          onClick={onStart}
        >
          <WinLogo />
        </button>

        <button className="win-tb-btn" aria-label="Search" title="Search" onClick={onSearch}>
          <svg width="19" height="19" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="8" r="5.2" />
            <path d="m12.1 12.1 3.5 3.5" />
          </svg>
        </button>

        <button className="win-tb-btn" aria-label="Task view" title="Task view" onClick={onTaskView}>
          <svg width="19" height="19" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
            <rect x="1.8" y="4.6" width="10.6" height="9.2" rx="1.8" />
            <path d="M5.6 2.2h8.6a2 2 0 0 1 2 2v7.2" strokeLinecap="round" />
          </svg>
        </button>

        {pinned.map((a) => {
          const win = windows.find((w) => w.id === a.id);
          const open = !!win;
          const active = focusedId === a.id && win && !win.minimized;
          return (
            <div
              key={a.id}
              className="win-tb-slot"
              onMouseEnter={() => open && openPreview(a.id)}
              onMouseLeave={scheduleClose}
            >
              <button
                className={`win-tb-btn ${open ? "open" : ""} ${active ? "active" : ""}`}
                aria-label={a.title}
                title={open ? undefined : a.title}
                onClick={() => onLaunch(a.id)}
              >
                <AppIcon id={a.id} size={26} radius={0.18} />
              </button>

              {open && preview === a.id && (
                <div
                  className="tb-preview"
                  onMouseEnter={cancelClose}
                  onMouseLeave={scheduleClose}
                >
                  <div className="tb-preview-head">
                    <AppIcon id={a.id} size={16} radius={0.18} />
                    <span className="tb-preview-title">{a.title}</span>
                    <button
                      className="tb-preview-close"
                      aria-label={`Close ${a.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreview(null);
                        onClose(a.id);
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                        <line x1="1.4" y1="1.4" x2="8.6" y2="8.6" />
                        <line x1="8.6" y1="1.4" x2="1.4" y2="8.6" />
                      </svg>
                    </button>
                  </div>
                  <button
                    className="tb-preview-thumb"
                    aria-label={`Open ${a.title}`}
                    onClick={() => {
                      setPreview(null);
                      onOpen(a.id);
                    }}
                  >
                    <div className="tb-preview-frame" aria-hidden="true">
                      <AppContent id={a.id} api={api} />
                    </div>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="win-tb-tray">
        <button className="win-tray-btn win-tray-chev" aria-label="Show hidden icons" title="Show hidden icons">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7.4 6 4.4l3 3" />
          </svg>
        </button>

        <button className="win-tray-btn win-tray-status" aria-label="Network, sound and battery" title="Network, sound and battery">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
            <path d="M2 6.4a9.3 9.3 0 0 1 12 0" />
            <path d="M4.2 8.9a6 6 0 0 1 7.6 0" />
            <path d="M6.4 11.3a3 3 0 0 1 3.2 0" />
            <circle cx="8" cy="13.3" r="0.9" fill="currentColor" stroke="none" />
          </svg>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6.2v3.6h2.3L8.2 13V3L4.8 6.2z" fill="currentColor" stroke="none" />
            <path d="M10.4 5.6a3.4 3.4 0 0 1 0 4.8" />
            <path d="M12.3 3.9a6 6 0 0 1 0 8.2" />
          </svg>
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="1" y="4.6" width="11.6" height="6.8" rx="1.6" />
            <rect x="2.4" y="6" width="8.8" height="4" rx="0.6" fill="currentColor" stroke="none" />
            <rect x="13.4" y="6.8" width="1.6" height="2.4" rx="0.6" fill="currentColor" stroke="none" />
          </svg>
        </button>

        <button className="win-tray-btn win-clock" aria-label="Clock and calendar" title="Date and time">
          <span>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          <span>{now.toLocaleDateString([], { month: "numeric", day: "numeric", year: "numeric" })}</span>
        </button>

        <button className="win-show-desktop" aria-label="Show desktop" title="Show desktop" onClick={onShowDesktop} />
      </div>
    </nav>
  );
}

function WinLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true">
      <defs>
        <linearGradient id="win-start-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4cc2ff" />
          <stop offset="1" stopColor="#0f7bd8" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="8.5" height="8.5" rx="0.9" fill="url(#win-start-logo)" />
      <rect x="10.5" y="1" width="8.5" height="8.5" rx="0.9" fill="url(#win-start-logo)" />
      <rect x="1" y="10.5" width="8.5" height="8.5" rx="0.9" fill="url(#win-start-logo)" />
      <rect x="10.5" y="10.5" width="8.5" height="8.5" rx="0.9" fill="url(#win-start-logo)" />
    </svg>
  );
}
