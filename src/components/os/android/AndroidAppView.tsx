import type { AppMeta } from "../../../data/types";
import type { AppApi } from "../../apps/appApi";
import { AppContent } from "../../apps/AppRouter";
import { AppIcon } from "../../apps/AppIcon";

interface Props {
  meta: AppMeta;
  api: AppApi;
  onHome: () => void;
}

// One UI app screen: a large collapsing-style header title, back arrow top-left.
export default function AndroidAppView({ meta, api, onHome }: Props) {
  return (
    <div className="and-appview" role="dialog" aria-label={meta.title}>
      <div className="and-appbar">
        <button className="and-appbar-back" onClick={onHome} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="and-appscroll">
        <h1 className="and-bigtitle">
          <AppIcon id={meta.id} size={30} radius={0.46} className="and-bigtitle-icon" />
          {meta.title}
        </h1>
        <AppContent id={meta.id} api={api} />
      </div>
    </div>
  );
}
