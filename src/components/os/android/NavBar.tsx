interface Props {
  onBack: () => void;
  onHome: () => void;
  onRecents: () => void;
  canBack: boolean;
}

// One UI 3-button navigation: recents ☰ · home ▢ · back ‹ (back on the right,
// matching Samsung's default order). Recents opens the overview; home returns
// to the launcher; back pops the current app.
export default function NavBar({ onBack, onHome, onRecents, canBack }: Props) {
  return (
    <nav className="and-navbar" aria-label="Navigation bar">
      <button className="and-nav-btn" aria-label="Recents" onClick={onRecents}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M4 4v12M10 4v12M16 4v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <button className="and-nav-btn" aria-label="Home" onClick={onHome}>
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
          <rect x="3.5" y="3.5" width="13" height="13" rx="4.2" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      <button className="and-nav-btn" aria-label="Back" onClick={onBack} disabled={!canBack}>
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
          <path d="M13 4 6 10l7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </nav>
  );
}
