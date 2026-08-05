// Immersive mode — get the browser's URL bar out of the way on mobile so the
// skin is the only thing on screen and reads as a real device.
//
// Browsers refuse to go fullscreen without a user gesture, so this can't run at
// load: instead we wait for the visitor's first touch and request it from that
// handler. Deliberately silent — no prompt, no button, no install banner. If the
// browser says no (iPhone Safari has no element fullscreen at all) nothing
// happens and the visitor never knows a request was made.
//
// As a side benefit, Android fullscreen also hides the system status bar, which
// leaves our drawn status bar as the only clock on screen.

let armed = false;

export function armImmersive(): () => void {
  if (armed || typeof document === "undefined") return () => {};

  const root = document.documentElement;

  // Touch devices only. Desktop has no URL bar worth reclaiming and an
  // unrequested fullscreen there would be jarring.
  const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  if (!coarse) return () => {};

  // Nothing to reclaim if the browser can't do it, or if we're already
  // chrome-free (fullscreen already, or launched from a home-screen shortcut).
  if (typeof root.requestFullscreen !== "function") return () => {};
  if (document.fullscreenElement) return () => {};
  if (matchMedia("(display-mode: standalone)").matches) return () => {};

  armed = true;

  // `pointerup` rather than `pointerdown`: a first touch is often the start of a
  // swipe, and resizing the viewport mid-gesture would stutter the animation
  // that swipe is driving. Waiting for the release keeps the user activation
  // (browsers honour it for the whole gesture) and lands the resize between
  // interactions instead of during one.
  const onFirstTouch = () => {
    cleanup();
    // Fire-and-forget. A rejection here is the normal, expected outcome on any
    // browser that doesn't allow this; it must never surface as an error.
    root.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  };

  // If the visitor leaves fullscreen (back-swipe, system gesture), that's a
  // choice — don't re-arm and pull them back in on their next tap.
  const onChange = () => {
    if (!document.fullscreenElement) cleanup();
  };

  function cleanup() {
    window.removeEventListener("pointerup", onFirstTouch);
    document.removeEventListener("fullscreenchange", onChange);
  }

  window.addEventListener("pointerup", onFirstTouch, { once: true, passive: true });
  document.addEventListener("fullscreenchange", onChange);

  return cleanup;
}
