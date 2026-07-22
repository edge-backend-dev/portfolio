import { services } from "../../data/services";
import { AppIcon } from "./AppIcon";
import { Icon } from "./icons";
import type { AppApi } from "./appApi";

export default function Services({ api }: { api: AppApi }) {
  return (
    <div className="app services">
      <header className="page-head">
        <h2 className="page-headline">
          What I can <em>build</em> for you.
        </h2>
        <p className="page-lede">
          Production-grade apps, systems, and automation — built end to end and shipped
          fast, iterated with your feedback.
        </p>
      </header>

      <div className="service-grid">
        {services.map((s) => (
          <article className="service-card" key={s.id}>
            <AppIcon id={s.id} size={40} radius={0.24} className="service-icon" />
            <h3 className="service-title">{s.title}</h3>
            <p className="service-pitch">{s.pitch}</p>
            <ul className="feature-list">
              {s.points.map((p, i) => (
                <li key={i}>
                  <Icon name="check" size={15} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="app-cta-row">
        <button className="btn-accent" onClick={() => api.openApp("contact")}>
          Start a project
        </button>
      </div>
    </div>
  );
}
