import type { AppMeta } from "../../../data/types";
import type { AppApi } from "../../apps/appApi";
import { AppContent } from "../../apps/AppRouter";
import { IOSAppIcon } from "../../apps/AppIcon";

interface Props {
  meta: AppMeta;
  api: AppApi;
  onHome: () => void;
}

export default function AppView({ meta, api, onHome }: Props) {
  return (
    <div className="ios-appview" role="dialog" aria-label={meta.title}>
      <div className="ios-navbar">
        <button className="ios-back" onClick={onHome} aria-label="Back to Home">
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
            <path d="M10 2 2 10l8 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Home</span>
        </button>
        <div className="ios-navtitle">
          <IOSAppIcon id={meta.id} size={22} className="ios-navtitle-icon" />
          {meta.title}
        </div>
        <div className="ios-nav-spacer" />
      </div>

      <div className="ios-appscroll">
        <AppContent id={meta.id} api={api} />
      </div>

      <button className="ios-home-indicator" onClick={onHome} aria-label="Home">
        <span />
      </button>
    </div>
  );
}
