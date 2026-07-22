import { useCallback, useEffect, useRef, useState } from "react";
import type { Theme, WallpaperPref } from "../../../shell/types";
import { wallpapers, getWallpaper, SLIDESHOW_INTERVAL_MS } from "../../../data/wallpapers";

// Full-bleed desktop wallpaper for the Windows & macOS skins. Two stacked image
// layers crossfade between slides: to change the picture we paint it on the
// hidden layer, then flip which layer is visible, so opacity animates 0↔1.
//
//  • pref === "auto"  → cycle through every wallpaper on a 15s timer
//  • pref === <id>    → hold that one wallpaper, no timer
//
// A theme-aware scrim keeps white desktop labels / taskbar contrast legible and
// makes the photos sit a touch brighter in light mode, darker in dark mode.

// Slight dark bias in both themes (safe direction for white icons/labels),
// lighter in light mode so the photos still read as bright.
const SCRIM: Record<Theme, string> = {
  light: "linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.03) 55%, rgba(0,0,0,0.16) 100%)",
  dark: "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.22) 55%, rgba(0,0,0,0.4) 100%)",
};

function preload(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

function startIndex(pref: WallpaperPref): number {
  if (pref === "auto") return 0;
  const i = wallpapers.findIndex((w) => w.id === pref);
  return i < 0 ? 0 : i;
}

export default function Wallpaper({ pref, theme }: { pref: WallpaperPref; theme: Theme }) {
  const initial = wallpapers[startIndex(pref)]?.src ?? wallpapers[0].src;

  // Two layers + which one is currently shown. Both refs mirror state so the
  // interval callback always sees the latest without re-subscribing.
  const [layers, setLayers] = useState<[string, string]>([initial, initial]);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const indexRef = useRef(startIndex(pref));

  const show = useCallback((src: string) => {
    const next = activeRef.current === 0 ? 1 : 0;
    setLayers((prev) => {
      const copy: [string, string] = [prev[0], prev[1]];
      copy[next] = src;
      return copy;
    });
    activeRef.current = next;
    setActive(next);
  }, []);

  // Warm the cache once so the first crossfade never pops in.
  useEffect(() => {
    wallpapers.forEach((w) => {
      const img = new Image();
      img.src = w.src;
    });
  }, []);

  useEffect(() => {
    let alive = true;

    if (pref !== "auto") {
      const w = getWallpaper(pref);
      if (w) {
        indexRef.current = startIndex(pref);
        preload(w.src).then(() => {
          if (alive) show(w.src);
        });
      }
      return () => {
        alive = false;
      };
    }

    // Auto slideshow: advance to the next picture every interval.
    const id = window.setInterval(() => {
      const nextIdx = (indexRef.current + 1) % wallpapers.length;
      indexRef.current = nextIdx;
      const src = wallpapers[nextIdx].src;
      preload(src).then(() => {
        if (alive) show(src);
      });
    }, SLIDESHOW_INTERVAL_MS);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [pref, show]);

  return (
    <div className="wp" aria-hidden="true">
      <div
        className="wp-layer"
        style={{ backgroundImage: `url("${layers[0]}")`, opacity: active === 0 ? 1 : 0 }}
      />
      <div
        className="wp-layer"
        style={{ backgroundImage: `url("${layers[1]}")`, opacity: active === 1 ? 1 : 0 }}
      />
      <div className="wp-scrim" style={{ background: SCRIM[theme] }} />
    </div>
  );
}
