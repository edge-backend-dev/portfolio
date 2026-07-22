import { resume } from "../../data/resume";
import { Icon } from "./icons";

export default function Resume() {
  return (
    <div className="app resume">
      <div className="resume-top">
        <p className="app-para" style={{ marginTop: 0 }}>
          {resume.summary}
        </p>
        {resume.pdfUrl && (
          <a className="btn-accent sm" href={resume.pdfUrl} download>
            <Icon name="resume" size={15} /> Download PDF
          </a>
        )}
      </div>

      <h2 className="section-h">Experience</h2>
      {resume.experience.map((e, i) => (
        <div className="timeline-item" key={i}>
          <div className="timeline-head">
            <strong>{e.role}</strong>
            <span className="period">{e.period}</span>
          </div>
          <div className="org">{e.org}</div>
          <ul className="bullets">
            {e.points.map((p, j) => (
              <li key={j}>{p}</li>
            ))}
          </ul>
          {e.tags && (
            <div className="tag-row">
              {e.tags.map((t) => (
                <span className="tag" key={t}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {resume.education && resume.education.length > 0 && (
        <>
          <h2 className="section-h">Education</h2>
          {resume.education.map((e, i) => (
            <div className="timeline-item" key={i}>
              <div className="timeline-head">
                <strong>{e.credential}</strong>
                <span className="period">{e.period}</span>
              </div>
              <div className="org">{e.org}</div>
              {e.note && <p className="app-faint">{e.note}</p>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
