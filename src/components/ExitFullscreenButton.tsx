import { useEffect, useState } from "react";

// Fallback for anyone who lands in the auto-fullscreen from shell/immersive.ts
// and doesn't know the swipe-down-from-the-top-edge gesture that briefly
// reveals the real system bars. Tracks fullscreen state directly rather than
// assuming Android — it only ever renders when requestFullscreen actually
// succeeded, so it stays correct even if that ever changes.
export default function ExitFullscreenButton() {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  if (!fullscreen) return null;

  return (
    <button
      type="button"
      className="exit-fullscreen-btn"
      onClick={() => void document.exitFullscreen().catch(() => {})}
    >
      Exit Full Screen
    </button>
  );
}
