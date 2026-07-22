import { projects, PLACEHOLDER_SLOTS } from "../../data/projects";
import type { AppApi } from "./appApi";

export default function Projects({ api }: { api: AppApi }) {
  const hasProjects = projects.length > 0;

  return (
    <div className="app projects">
      {!hasProjects ? (
        <>
          <div className="empty-note">
            <strong>Case studies are on the way.</strong>
            <p>
              I'm finishing several products right now — a custom backend platform, a real-time
              meeting app, and more. Each gets a full write-up here the moment it ships.
            </p>
          </div>
          <div className="project-grid">
            {Array.from({ length: PLACEHOLDER_SLOTS }).map((_, i) => (
              <div className="project-card locked" key={i}>
                <div className="lock-badge" aria-hidden="true">
                  🔒
                </div>
                <div className="skeleton-title" />
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
                <span className="soon-tag">Coming soon</span>
              </div>
            ))}
          </div>
          <div className="app-cta-row">
            <button className="btn-ghost" onClick={() => api.openApp("contact")}>
              Want early access? Reach out
            </button>
          </div>
        </>
      ) : (
        <div className="project-grid">
          {projects.map((p) => (
            <div className="project-card" key={p.id}>
              <div className="project-head">
                <h3>{p.title}</h3>
                <span className={`status-tag ${p.status}`}>{p.status.replace("-", " ")}</span>
              </div>
              <p className="project-summary">{p.summary}</p>
              {p.tags && (
                <div className="tag-row">
                  {p.tags.map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {p.links && (
                <div className="link-row">
                  {p.links.map((l) => (
                    <a className="link-chip" key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
