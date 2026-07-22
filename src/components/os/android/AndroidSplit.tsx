import { useRef, useState } from "react";
import { getApp } from "../../../data/apps";
import type { AppApi } from "../../apps/appApi";
import { AppContent } from "../../apps/AppRouter";
import { AppIcon } from "../../apps/AppIcon";
import type { SplitPair } from "./AndroidShell";

interface Props {
  split: SplitPair;
  api: AppApi;
  onExpand: (id: string) => void;
}

// One UI split-screen: two live app panes stacked with a draggable divider.
// Drag the handle to rebalance; the expand button on a pane exits split and
// opens that app full-screen.
export default function AndroidSplit({ split, api, onExpand }: Props) {
  const [topFrac, setTopFrac] = useState(0.5);
  const ref = useRef<HTMLDivElement>(null);

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    const host = ref.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const f = (ev.clientY - rect.top) / rect.height;
      setTopFrac(Math.min(0.78, Math.max(0.22, f)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div className="and-split" ref={ref}>
      <Pane id={split.top} api={api} onExpand={onExpand} flex={topFrac} />
      <div
        className="and-split-divider"
        onPointerDown={startDrag}
        role="separator"
        aria-label="Resize split screen"
      >
        <span className="and-split-grip" />
      </div>
      <Pane id={split.bottom} api={api} onExpand={onExpand} flex={1 - topFrac} />
    </div>
  );
}

function Pane({
  id,
  api,
  onExpand,
  flex,
}: {
  id: string;
  api: AppApi;
  onExpand: (id: string) => void;
  flex: number;
}) {
  const meta = getApp(id);
  if (!meta) return null;
  return (
    <div className="and-split-pane" style={{ flex: `${flex} 1 0` }}>
      <div className="and-split-bar">
        <AppIcon id={id} size={20} className="and-split-bar-icon" />
        <span className="and-split-bar-title">{meta.title}</span>
        <button
          className="and-split-expand"
          onClick={() => onExpand(id)}
          aria-label={`Open ${meta.title} full screen`}
          title="Open full screen"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 8V4h4M16 12v4h-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div className="and-split-scroll">
        <h2 className="and-split-h1">
          <AppIcon id={id} size={26} />
          {meta.title}
        </h2>
        <AppContent id={id} api={api} />
      </div>
    </div>
  );
}
