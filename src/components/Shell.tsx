import { useEffect, useState } from "react";
import type { OSKind, Theme, WallpaperPref } from "../shell/types";
import {
  loadOSOverride,
  saveOSOverride,
  loadTheme,
  saveTheme,
  loadWallpaper,
  saveWallpaper,
} from "../shell/persistence";
import { detectOS } from "../shell/detectOS";
import WindowsShell from "./os/windows/WindowsShell";
import MacShell from "./os/macos/MacShell";
import IOSShell from "./os/ios/IOSShell";
import AndroidShell from "./os/android/AndroidShell";

// Top-level island. Owns theme + which-OS-look, stamps the token attributes on
// its root, and renders the matching skin. autoOS is detected from the device;
// the Settings override (or ?os= param) can force a specific look.

// ?os=windows|macos|ios|android lets you preview/share a specific look.
function queryOS(): OSKind | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("os");
  return q === "windows" || q === "macos" || q === "ios" || q === "android" ? q : null;
}

// This island is client:only (never server-rendered), so navigator/localStorage
// are already available at first render. We resolve the OS, theme and wallpaper
// SYNCHRONOUSLY in the state initializers — if we deferred them to a post-paint
// effect, the first painted frame would show the provisional skin and then swap,
// which is the "flash of the wrong OS on reload" you'd see.
function initialOverride(): OSKind | null {
  return queryOS() ?? loadOSOverride();
}
function initialTheme(): Theme {
  return (
    loadTheme() ??
    (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light")
  );
}

export default function Shell() {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [override, setOverrideState] = useState<OSKind | null>(initialOverride);
  const [autoOS] = useState<OSKind>(detectOS); // detected once, before first paint
  const [wallpaper, setWallpaperState] = useState<WallpaperPref>(() => loadWallpaper() ?? "auto");

  useEffect(() => {
    // The server-rendered SEO fallback stays in the DOM (for crawlers/no-JS)
    // but is now visually covered by the shell — hide it from assistive tech
    // and the tab order so content isn't announced twice.
    const fb = document.getElementById("fallback");
    if (fb) {
      fb.setAttribute("aria-hidden", "true");
      fb.setAttribute("inert", "");
    }

    // Persist a ?os= override so the chosen look sticks after the param is gone.
    const q = queryOS();
    if (q) saveOSOverride(q);
  }, []);

  const os: OSKind = override ?? autoOS;

  function setTheme(t: Theme) {
    setThemeState(t);
    saveTheme(t);
  }
  function setOS(next: OSKind | null) {
    setOverrideState(next);
    saveOSOverride(next);
  }
  function setWallpaper(next: WallpaperPref) {
    setWallpaperState(next);
    saveWallpaper(next);
  }

  const skinProps = {
    theme,
    setTheme,
    os,
    setOS,
    autoOS,
    overriding: override !== null,
    wallpaper,
    setWallpaper,
  };

  return (
    <div className="shell-root" data-os={os} data-theme={theme}>
      {renderSkin(os, skinProps)}
    </div>
  );
}

function renderSkin(os: OSKind, props: React.ComponentProps<typeof WindowsShell>) {
  switch (os) {
    case "windows":
      return <WindowsShell {...props} />;
    case "macos":
      return <MacShell {...props} />;
    case "ios":
      return <IOSShell {...props} />;
    case "android":
      return <AndroidShell {...props} />;
    default:
      return <WindowsShell {...props} />;
  }
}
