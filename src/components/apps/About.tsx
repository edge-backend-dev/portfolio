import { useState } from "react";
import { profile } from "../../data/profile";
import { Icon } from "./icons";
import type { AppApi } from "./appApi";

// profile.ts ships unfilled fields wrapped in ⟨…⟩; treat any wrapped value as
// absent so a placeholder link never renders a broken href. (Same rule as Contact.)
const isPlaceholder = (v: string | undefined) => !v || /[⟨⟩]/.test(v);

export default function About({ api }: { api: AppApi }) {
  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  // email always resolves; social links only show once their href is filled in
  const links = profile.links.filter((l) => !isPlaceholder(l.href));

  // if the headshot ever fails to load, fall back to the accent initials tile
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <div className="app about">
      <header className="about-header">
        {/* ---------- identity text ---------- */}
        <div className="about-id">
          <div>
            <h1 className="about-name">{profile.name}</h1>
            <p className="about-role">{profile.role}</p>
          </div>

          {profile.availability.open && (
            <span className="avail-pill">
              <span className="dot" />
              Available for new projects
            </span>
          )}

          {links.length > 0 && (
            <div className="link-row">
              {links.map((l) => (
                <a
                  className="link-chip"
                  key={l.label}
                  href={l.href}
                  target={l.icon === "email" ? undefined : "_blank"}
                  rel="noopener noreferrer"
                >
                  <Icon name={l.icon} size={16} />
                  <span>{l.label}</span>
                </a>
              ))}
            </div>
          )}

          <div className="app-cta-row">
            <button className="btn-accent" onClick={() => api.openApp("contact")}>
              Get in touch
            </button>
            <button className="btn-ghost" onClick={() => api.openApp("projects")}>
              View projects
            </button>
          </div>
        </div>

        {/* ---------- portrait (falls back to initials if the image is missing) ---------- */}
        <div className="about-portrait">
          {photoFailed ? (
            <div className="about-photo about-photo--fallback" aria-hidden="true">
              {initials}
            </div>
          ) : (
            <img
              className="about-photo"
              src="/profile.jpg"
              alt={`Portrait of ${profile.name}`}
              width={600}
              height={888}
              onError={() => setPhotoFailed(true)}
            />
          )}
        </div>
      </header>

      {/* ---------- the story ---------- */}
      <div className="about-body">
        <p className="about-lede">{profile.tagline}</p>
        {profile.bio.map((p, i) => (
          <p className="app-para" key={i}>
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}
