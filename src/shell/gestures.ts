// Minimal pointer-gesture helper shared by title-bar drag and corner-resize.
// Reports cumulative dx/dy from the gesture start; the caller maps that onto
// window geometry. Uses window-level listeners so the gesture keeps tracking
// even if the pointer briefly leaves the element.

export function startGesture(
  e: { clientX: number; clientY: number; preventDefault: () => void },
  onMove: (dx: number, dy: number) => void,
  onEnd?: () => void,
): void {
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;

  let frame = 0;
  let lastDx = 0;
  let lastDy = 0;

  const flush = () => {
    frame = 0;
    onMove(lastDx, lastDy);
  };

  const move = (ev: PointerEvent) => {
    lastDx = ev.clientX - startX;
    lastDy = ev.clientY - startY;
    if (!frame) frame = requestAnimationFrame(flush);
  };

  const up = () => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    onEnd?.();
  };

  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}
