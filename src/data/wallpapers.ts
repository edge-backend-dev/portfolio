// Desktop wallpapers used by the Windows & macOS skins. Files live in
// public/wallpapers and are referenced by absolute URL. `label` shows in the
// Settings picker. Order here is the slideshow order.

export interface Wallpaper {
  id: string;
  src: string;
  label: string;
}

export const wallpapers: Wallpaper[] = [
  { id: "bigsur", src: "/wallpapers/bigsur.svg", label: "Big Sur" },
  { id: "wall-1", src: "/wallpapers/wall-1.jpg", label: "Wallpaper 1" },
  { id: "wall-2", src: "/wallpapers/wall-2.jpg", label: "Wallpaper 2" },
  { id: "wall-3", src: "/wallpapers/wall-3.jpg", label: "Wallpaper 3" },
  { id: "wall-4", src: "/wallpapers/wall-4.jpg", label: "Wallpaper 4" },
  { id: "wall-5", src: "/wallpapers/wall-5.jpg", label: "Wallpaper 5" },
  { id: "wall-6", src: "/wallpapers/wall-6.jpg", label: "Wallpaper 6" },
];

/** The Mac skin holds this one by default (Big Sur ships a single wallpaper). */
export const MAC_DEFAULT_WALLPAPER = "bigsur";

/** How long each slide stays before crossfading to the next, in auto mode. */
export const SLIDESHOW_INTERVAL_MS = 20_000;

export function getWallpaper(id: string): Wallpaper | undefined {
  return wallpapers.find((w) => w.id === id);
}
