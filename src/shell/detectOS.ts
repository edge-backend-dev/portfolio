import type { OSKind } from "./types";

// Best-effort OS detection, most-reliable signal first:
//   1. navigator.userAgentData (Client Hints, Chromium) — platform + mobile
//   2. UA string parsing, with the iPadOS-reports-as-Mac correction
//   3. pointer/touch heuristics as a tie-breaker
// Always returns something sensible; the user can override in Settings.

interface UADataLike {
  platform?: string;
  mobile?: boolean;
}

export function detectOS(): OSKind {
  if (typeof navigator === "undefined") return "windows";

  const uaData = (navigator as Navigator & { userAgentData?: UADataLike }).userAgentData;
  const ua = navigator.userAgent || "";
  const touch = (navigator.maxTouchPoints ?? 0) > 1;
  const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

  // 1) Client Hints
  if (uaData?.platform) {
    const p = uaData.platform.toLowerCase();
    if (p.includes("android")) return "android";
    if (p.includes("windows")) return "windows";
    if (p.includes("mac")) {
      // iPad on iPadOS reports platform "macOS" but is a touch device
      return uaData.mobile || touch ? "ios" : "macos";
    }
    if (p.includes("ios") || p.includes("iphone") || p.includes("ipad")) return "ios";
  }

  // 2) UA string
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipod/i.test(ua)) return "ios";
  if (/ipad/i.test(ua)) return "ios";
  // iPadOS 13+ masquerades as Macintosh — detect via touch
  if (/macintosh|mac os x/i.test(ua)) return touch || coarse ? "ios" : "macos";
  if (/windows/i.test(ua)) return "windows";
  if (/cros/i.test(ua)) return "android"; // ChromeOS → closest touch-friendly skin

  // 3) Fallback: touch → android look, otherwise windows
  return coarse ? "android" : "windows";
}
